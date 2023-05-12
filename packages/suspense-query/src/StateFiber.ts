import * as React from "react";
import {
	FiberProducer,
	FiberPromise,
	FiberStateFulfilled,
	FiberStatePending,
	FiberStateRejected,
	FiberWithoutSource,
	QueryToInvalidate,
	RunReturn,
	StateFiber,
	StateFiberCacheContextType,
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
import {
	NO_TRANSITION,
	PENDING,
	PENDING_TRANSITION,
	SubscriptionKind,
	TRANSITION,
} from "./StateFiberFlags";

export type CurrentGlobals = {
	isRenderPhaseRun: boolean;
	startTransition: React.TransitionStartFunction;
};
export let SuspenseDispatcher: CurrentGlobals = {
	isRenderPhaseRun: false,
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
	root: StateFiberCacheContextType,
	query: FiberProducer<T, A, R>,
	options?: StateFiberConfig<T, A, R>
) {
	let withoutSource: FiberWithoutSource<T, A, R> = {
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

	let fiber = withoutSource as StateFiber<T, A, R>;
	bindFiberMethods(fiber);

	let init = fiber.config.initialValue;
	if (init !== undefined) {
		fiber.current = tagFulfilledPromise(Promise.resolve(init), init);
	}

	return fiber;
}

function bindFiberMethods<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>
) {
	fiber.run = (runStateFiber as typeof runStateFiber<T, A, R>).bind(
		null,
		fiber
	);
	fiber.setData = (setStateFiberData as typeof setStateFiberData<T, A, R>).bind(
		null,
		fiber
	);
	fiber.setError = (
		setStateFiberError as typeof setStateFiberError<T, A, R>
	).bind(null, fiber);
	fiber.retain = (
		createSubscription as typeof createSubscription<T, A, R>
	).bind(null, fiber);
}

function getInitialSubscriptionFlags(
	fiber: StateFiber<any, any, any>,
	isPending: boolean
) {
	let flags = 0;

	if (fiber.alternate) {
		flags |= PENDING;
	}
	if (isPending) {
		flags |= PENDING_TRANSITION;
	}

	return flags;
}

export function createSubscription<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	kind: SubscriptionKind,
	update: React.Dispatch<React.SetStateAction<number>>,
	startTransition: React.TransitionStartFunction,
	isPending: boolean
): StateFiberListener<T, A, R> {
	let subscription: Omit<StateFiberListener<T, A, R>, "clean"> = {
		kind,
		update,
		start: startTransition,
		flags: getInitialSubscriptionFlags(fiber, isPending),
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

function setStateFiberData<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	data: T
): void {
	applyUpdate(
		fiber,
		[data] as A,
		tagFulfilledPromise(Promise.resolve(data), data),
		fiber.dependencies
	);
}

function setStateFiberError<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	error: R
): void {
	applyUpdate(
		fiber,
		[error] as A,
		tagRejectedPromise(Promise.reject(error), error),
		fiber.dependencies
	);
}

function runStateFiber<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	...args: A
): RunReturn<T, R> {
	let updatePromise: FiberPromise<T, R> | null = null;

	// when there is fn, set the state (as success) with the first ever argument
	let fiberFn = fiber.query;
	let dependencies = fiber.dependencies;
	if (!fiberFn) {
		let value = args[0] as T;
		updatePromise = tagFulfilledPromise(Promise.resolve(value), value);
		applyUpdate(fiber, args, updatePromise, dependencies);
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
			updatePromise = tagPendingPromise(result);
			result.then(
				(value) => {
					if (fiber.alternate === updatePromise) {
						applyUpdate(
							fiber,
							args,
							tagFulfilledPromise(updatePromise!, value),
							dependencies
						);
					}
				},
				(reason) => {
					if (fiber.alternate === updatePromise) {
						applyUpdate(
							fiber,
							args,
							tagRejectedPromise(updatePromise!, reason),
							dependencies
						);
					}
				}
			);
		}

		applyUpdate(fiber, args, updatePromise, dependencies);
	} else {
		applyUpdate(
			fiber,
			args,
			tagFulfilledPromise(Promise.resolve(result), result),
			dependencies
		);
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

function applyUpdate<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	args: A,
	update: FiberPromise<T, R>,
	deps: QueryToInvalidate<any, any, any>[] | null
) {
	let isRendering = SuspenseDispatcher.isRenderPhaseRun;

	if (!fiber.updateQueue) {
		fiber.updateQueue = {
			args,
			update,
			next: null,
		};
	} else {
		let queue = fiber.updateQueue;
		while (queue.next !== null) {
			queue = queue.next;
		}
		queue.next = {
			args,
			update,
			next: null,
		};
	}
	if (!fiber.current) {
		processUpdateQueue(fiber);
	}

	if (isRendering) {
		let currentTransition = SuspenseDispatcher.startTransition;

		setTimeout(() => {
			let capturedTransition = SuspenseDispatcher.startTransition;
			SuspenseDispatcher.startTransition = currentTransition;
			processUpdateQueue(fiber);
			evictFiberDependencies(fiber, deps);
			notifyFiberListeners(fiber);
			SuspenseDispatcher.startTransition = capturedTransition;
		});
	} else {
		processUpdateQueue(fiber);
		evictFiberDependencies(fiber, deps);
		notifyFiberListeners(fiber);
	}
}

function processUpdateQueue<T, A extends unknown[], R>(
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
}

function notifyFiberListeners(fiber: StateFiber<any, any, any>) {
	SuspenseDispatcher.startTransition(() => {
		fiber.retainers[TRANSITION]?.forEach((sub) => {
			sub.update(defaultUpdater);
		});
	});
	fiber.retainers[NO_TRANSITION]?.forEach((sub) => {
		sub.update(defaultUpdater);
	});
}

export function tagFulfilledPromise<T>(
	promise: Promise<T>,
	value: T
): FiberStateFulfilled<T> {
	let fulfilledPromise = promise as FiberStateFulfilled<T>;
	fulfilledPromise.status = "fulfilled";
	fulfilledPromise.value = value;
	return fulfilledPromise;
}

export function tagRejectedPromise<T, R>(
	promise: Promise<any>,
	reason: R
): FiberStateRejected<T, R> {
	let fulfilledPromise = promise as FiberStateRejected<T, R>;
	fulfilledPromise.status = "rejected";
	fulfilledPromise.reason = reason;
	return fulfilledPromise;
}

export function tagPendingPromise<T, A extends unknown[], R>(
	promise: Promise<T>
): FiberStatePending<T, R> {
	let fulfilledPromise = promise as FiberStatePending<T, R>;
	fulfilledPromise.status = "pending";
	return fulfilledPromise;
}
