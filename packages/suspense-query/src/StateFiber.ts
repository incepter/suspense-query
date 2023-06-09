import * as React from "react";
import {
	FiberProducer,
	FiberPromise,
	FiberStateFulfilled,
	FiberStatePending,
	FiberStateRejected,
	QueryToInvalidate,
	RunReturn,
	StateFiber,
	StateFiberCache,
	StateFiberConfig,
	StateFiberListener,
} from "./types";
import {
	__DEV__,
	assign,
	defaultUpdater,
	isPromise,
	resolveComponentName,
} from "./shared";
import { NO_TRANSITION, SubscriptionKind, TRANSITION } from "./StateFiberFlags";

export type CurrentGlobals = {
	isRenderPhaseRun: boolean;
	startTransition: React.TransitionStartFunction;
	notifyingSubscription: StateFiberListener<any, any, any> | null;
};
export let suspendingPromises = new WeakSet<any>();
export let SuspenseDispatcher: CurrentGlobals = {
	isRenderPhaseRun: false,
	notifyingSubscription: null,
	startTransition: React.startTransition,
};

export function getOrCreateStateFiber<T, A extends unknown[], R>(
	cache: Map<FiberProducer<T, A, R>, StateFiber<T, A, R>>,
	query: FiberProducer<T, A, R>,
	options?: StateFiberConfig<T, A, R>
) {
	if (!cache.has(query)) {
		let fiber = createFiber<T, A, R>(cache, query, options);
		cache.set(query, fiber);
		return fiber;
	}
	let fiber = cache.get(query) as StateFiber<T, A, R>;

	if (options) {
		assign(fiber.config, options);
	}
	return fiber;
}

function createFiber<T, A extends unknown[], R>(
	root: StateFiberCache,
	query: FiberProducer<T, A, R>,
	options?: StateFiberConfig<T, A, R>
) {
	let fiber: StateFiber<T, A, R> = {
		root,

		query,
		updateQueue: null,
		dependencies: null,
		config: assign({}, options),
		name: options && options.name,

		args: null,
		current: null,
		alternate: null,
		retainers: {
			[TRANSITION]: null,
			[NO_TRANSITION]: null,
		},
	};

	let init = fiber.config.initialValue;
	if (init !== undefined) {
		fiber.current = tagFulfilled(Promise.resolve(init), init);
	}

	return fiber;
}

export function retain<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	kind: SubscriptionKind,
	update: React.Dispatch<React.SetStateAction<number>>,
	startTransition: React.TransitionStartFunction
): StateFiberListener<T, A, R> {
	let subscription: Omit<StateFiberListener<T, A, R>, "clean"> = {
		kind,
		update,
		flags: 0,
		start: startTransition,
		at: __DEV__ ? resolveComponentName() : undefined,
	};

	function clean() {
		let actualRetainers = fiber.retainers[kind];
		if (!actualRetainers) {
			return;
		}
		let current = actualRetainers.get(update);
		// unsubscribe only if it is the current
		if (current === subscription) {
			actualRetainers.delete(update);
		}
	}

	(subscription as StateFiberListener<T, A, R>).clean = clean;
	return subscription as StateFiberListener<T, A, R>;
}

export function runStateFiber<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	args: A
): RunReturn<T, R> {
	let updatePromise: FiberPromise<T, R> | null = null;

	// when there is fn, set the state (as success) with the first ever argument
	let fiberFn = fiber.query;
	let deps = fiber.dependencies;
	if (!fiberFn) {
		let value = args[0] as T;
		updatePromise = tagFulfilled(Promise.resolve(value), value);
		applyUpdate(fiber, args, updatePromise, deps);
		return;
	}

	let result = fiberFn.apply(null, args);

	if (isPromise(result)) {
		let maybeKnown = result as FiberPromise<T, R>;
		if (maybeKnown.status) {
			switch (maybeKnown.status) {
				case "pending":
				case "rejected":
				case "fulfilled": {
					updatePromise = maybeKnown;
					break;
				}
			}
		} else {
			updatePromise = tagPending(result);
			result.then(
				(value) => {
					// tag the fulfilled promise so it is recognized next time
					let resolvingPromise = tagFulfilled(updatePromise!, value);

					// apply update on fiber only if its the currently pending promise
					// or else, this means it is a stale closure, but we tag it either
					// ways in the expression before.
					if (fiber.alternate === updatePromise) {
						applyUpdate(fiber, args, resolvingPromise, deps);
					}

					return value;
				},
				(reason) => {
					// same as the comments in the other 'then success callback'
					let rejectingPromise = tagRejected(updatePromise!, reason);
					if (fiber.alternate === updatePromise) {
						applyUpdate(fiber, args, rejectingPromise, deps);
					}
					throw reason;
				}
			);
		}

		applyUpdate(fiber, args, updatePromise, deps);
	} else {
		let resolvingPromise = tagFulfilled(Promise.resolve(result), result);
		applyUpdate(fiber, args, resolvingPromise, deps);
	}
}

function evictFiberDependencies<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	deps: QueryToInvalidate<any, any, any>[] | null
) {
	if (fiber.current?.status !== "fulfilled" || !deps) {
		return;
	}

	let cache = fiber.root;
	for (let dep of deps) {
		let fn = typeof dep === "function" ? dep : dep.query;
		let maybeTargetFiber = cache.get(fn);
		if (maybeTargetFiber) {
			maybeTargetFiber.current = null;
			notifyFiberListeners(maybeTargetFiber);
		}
	}
}

export function applyUpdate<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	args: A,
	update: FiberPromise<T, R>,
	deps: QueryToInvalidate<any, any, any>[] | null
) {
	if (fiber.updateQueue === null) {
		fiber.updateQueue = { args, update, next: null };
	} else {
		let queue = fiber.updateQueue;
		while (queue.next !== null) {
			queue = queue.next;
		}
		queue.next = { args, update, next: null };
	}


	// if this state fiber has no current in it yet, immediately assign it
	if (fiber.current === null) {
		processUpdateQueue(fiber);
	}
	// this update is supposed to suspend the tree
	// force flush updateQueue here
	if (suspendingPromises.has(update)) {
		// if it is resolving, it should not flush right away and notify listeners
		// we ll need to wait until the suspender renders back
		// todo: schedule some artificial notification in case the
		//  suspended component was thrown away
		if (update.status !== "pending") {
			return;
		}
		processUpdateQueue(fiber);
	}
	flushQueueAndNotifyListeners(fiber);
}

export function flushQueueAndNotifyListeners<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>
) {
	let isRendering = SuspenseDispatcher.isRenderPhaseRun;

	if (isRendering) {
		processUpdateQueue(fiber);
		let currentTransition = SuspenseDispatcher.startTransition;

		queueMicrotask(() => {
			let capturedTransition = SuspenseDispatcher.startTransition;
			SuspenseDispatcher.startTransition = currentTransition;
			processUpdateQueue(fiber);
			evictFiberDependencies(fiber, fiber.dependencies);
			notifyFiberListeners(fiber);
			SuspenseDispatcher.startTransition = capturedTransition;
		});
	} else {
		processUpdateQueue(fiber);
		evictFiberDependencies(fiber, fiber.dependencies);
		notifyFiberListeners(fiber);
	}
}

export function processUpdateQueue<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>
) {
	let queue = fiber.updateQueue;
	if (!queue) {
		return;
	}
	while (queue !== null) {
		let { args, update } = queue;
		fiber.args = args;
		if (update.status === "pending") {
			fiber.alternate = update;
		} else {
			fiber.current = update;
			fiber.alternate = null;
		}
		queue = queue.next;
	}
	fiber.updateQueue = null;
}

function notifyFiberListeners(fiber: StateFiber<any, any, any>) {
	let currentSubscription = SuspenseDispatcher.notifyingSubscription;
	if (currentSubscription !== null) {
		notifyAllBut(fiber, currentSubscription);
	} else {
		notifyAll(fiber);
	}
}

function notifyAllBut(
	fiber: StateFiber<any, any, any>,
	currentSubscription: StateFiberListener<any, any, any>
) {
	SuspenseDispatcher.startTransition(() => {
		fiber.retainers[TRANSITION]?.forEach((sub) => {
			if (currentSubscription !== sub) {
				sub.update(defaultUpdater);
			}
		});
	});
	fiber.retainers[NO_TRANSITION]?.forEach((sub) => {
		if (currentSubscription !== sub) {
			sub.update(defaultUpdater);
		}
	});
}

function notifyAll(fiber: StateFiber<any, any, any>) {
	SuspenseDispatcher.startTransition(() => {
		fiber.retainers[TRANSITION]?.forEach((sub) => {
			sub.update(defaultUpdater);
		});
	});
	fiber.retainers[NO_TRANSITION]?.forEach((sub) => {
		sub.update(defaultUpdater);
	});
}

export function tagFulfilled<T>(
	promise: Promise<T>,
	value: T
): FiberStateFulfilled<T> {
	let fulfilledPromise = promise as FiberStateFulfilled<T>;
	fulfilledPromise.status = "fulfilled";
	fulfilledPromise.value = value;
	return fulfilledPromise;
}

export function tagRejected<T, R>(
	promise: Promise<any>,
	reason: R
): FiberStateRejected<T, R> {
	let fulfilledPromise = promise as FiberStateRejected<T, R>;
	fulfilledPromise.status = "rejected";
	fulfilledPromise.reason = reason;
	return fulfilledPromise;
}

export function tagPending<T, A extends unknown[], R>(
	promise: Promise<T>
): FiberStatePending<T, R> {
	let fulfilledPromise = promise as FiberStatePending<T, R>;
	fulfilledPromise.status = "pending";
	return fulfilledPromise;
}

export function addSuspendingPromise(promise) {
	suspendingPromises.add(promise);
}

export function removeSuspendingPromise(promise) {
	suspendingPromises.delete(promise);
}
