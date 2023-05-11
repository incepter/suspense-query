import * as React from "react";
import {
	FiberPromise,
	FiberStateFulfilled,
	FiberStatePending,
	FiberStateRejected,
	FiberWithoutSource,
	RunReturn,
	StateFiber,
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
import { DATA, PENDING_AWARE, SubscriptionKind } from "./SubscriptionKind";

export type CurrentGlobals = {
	isRenderPhaseRun: boolean;
	startTransition: React.TransitionStartFunction;
};
export const SuspenseDispatcher: CurrentGlobals = {
	isRenderPhaseRun: false,
	startTransition: React.startTransition,
};

export function getOrCreateStateFiber<T, A extends unknown[], R>(
	cache: Map<string, StateFiber<T, A, R>>,
	name: string,
	options?: StateFiberConfig<T, A, R>
) {
	if (!cache.has(name)) {
		const fiber = createFiber<T, A, R>(name, options);
		cache.set(name, fiber);
		return fiber;
	}
	const fiber = cache.get(name) as StateFiber<T, A, R>;

	if (options) {
		assign(fiber.config, options);
	}
	return fiber;
}

function createFiber<T, A extends unknown[], R>(
	name: string,
	options?: StateFiberConfig<T, A, R>
) {
	const withoutSource: FiberWithoutSource<T, A, R> = {
		name,
		cache: null,
		config: assign({}, options),

		args: null,
		current: null,
		alternate: null,
		retainers: {
			[DATA]: null,
			[PENDING_AWARE]: null,
		},
	};

	const fiber = withoutSource as StateFiber<T, A, R>;
	bindFiberMethods(fiber);

	const init = fiber.config.initialValue;
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

export function createSubscription<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	kind: SubscriptionKind,
	update: React.Dispatch<React.SetStateAction<number>>,
	startTransition: React.TransitionStartFunction,
	isPending: boolean
): StateFiberListener<T, A, R> {
	const subscription: Omit<StateFiberListener<T, A, R>, "clean"> = {
		kind,
		update,
		pending: isPending,
		start: startTransition,
		at: __DEV__ ? resolveComponentName() : undefined,
	};

	function clean() {
		const actualRetainers = fiber.retainers[kind];
		if (!actualRetainers) {
			return;
		}
		const prev = actualRetainers.get(update);
		// unsubscribe only if it is the current
		if (prev === subscription) {
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
	fiber.alternate = null;
	fiber.current = tagFulfilledPromise(Promise.resolve(data), data);
	notifyFiberListeners(fiber);
}

function setStateFiberError<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	error: R
): void {
	fiber.alternate = null;
	fiber.current = tagRejectedPromise(Promise.reject(error), error);
	notifyFiberListeners(fiber);
}

function runStateFiber<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	...args: A
): RunReturn<T, R> {
	if (fiber.alternate) {
		if (typeof fiber.alternate.abort === "function") {
			fiber.alternate.abort();
		}
		fiber.alternate = null;
	}

	fiber.args = args;
	if (!fiber.config.fn) {
		fiber.setData(args[0] as T);
		return createNoopReturn(fiber.current as Promise<T>);
	}

	let aborted = false;
	const abort: RunReturn<T, R> = () => {
		if (aborted) {
			return;
		}
		aborted = true;
	};

	const result = fiber.config.fn.apply(null, args);

	if (isPromise(result)) {
		let maybeKnown = result as FiberPromise<T, R>;
		if (maybeKnown.status) {
			// this path means it is already cached and maybe ready promise
			switch (maybeKnown.status) {
				case "pending": {
					abort.promise = maybeKnown;
					fiber.alternate = maybeKnown;
					fiber.alternate.abort = abort;
					break;
				}
				case "rejected":
				case "fulfilled": {
					fiber.alternate = null;
					fiber.current = maybeKnown;
					break;
				}
			}
		} else {
			fiber.alternate = tagPendingPromise(result);
			fiber.alternate.abort = abort;
			result.then(
				(value) => fulfillPendingFiber(aborted, result, fiber, value),
				(reason) => rejectPendingFiber(aborted, result, fiber, reason)
			);
		}

		notifyFiberListeners(fiber);
		return abort;
	} else {
		// this path means that the result is not a promise
		fiber.alternate = null;
		fiber.current = tagFulfilledPromise(Promise.resolve(result), result);

		notifyFiberListeners(fiber);
		return createNoopReturn(fiber.current as Promise<T>);
	}
}

function createNoopReturn<T, R>(promise: Promise<T>) {
	const noop: RunReturn<T, R> = () => {};
	noop.promise = promise;
	return noop;
}

function fulfillPendingFiber<T, A extends unknown[], R>(
	didAbort: boolean,
	result: Promise<T>,
	fiber: StateFiber<T, A, R>,
	value: T
): T {
	if (!didAbort && fiber.alternate === result) {
		fiber.alternate = null;
		fiber.current = tagFulfilledPromise(result, value);
		notifyFiberListeners(fiber);
	}
	return value;
}

function rejectPendingFiber<T, A extends unknown[], R>(
	didAbort: boolean,
	result: Promise<T>,
	fiber: StateFiber<T, A, R>,
	reason: R
): void {
	if (!didAbort && fiber.alternate === result) {
		fiber.alternate = null;
		fiber.current = tagRejectedPromise(result, reason);
		notifyFiberListeners(fiber);
	}
}

export function notifyFiberListeners<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>
) {
	const isCurrentlyRendering = SuspenseDispatcher.isRenderPhaseRun;
	if (isCurrentlyRendering) {
		setTimeout(() => {
			SuspenseDispatcher.startTransition(() => {
				fiber.retainers[DATA]?.forEach((sub) => {
					sub.update(defaultUpdater);
				});
			});
			fiber.retainers[PENDING_AWARE]?.forEach((sub) => {
				sub.update(defaultUpdater);
			});
		});
	} else {
		SuspenseDispatcher.startTransition(() => {
			fiber.retainers[DATA]?.forEach((sub) => {
				sub.update(defaultUpdater);
			});
		});
		fiber.retainers[PENDING_AWARE]?.forEach((sub) => {
			sub.update(defaultUpdater);
		});
	}
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

export function tagRejectedPromise<R>(
	promise: Promise<any>,
	reason: R
): FiberStateRejected<R> {
	let fulfilledPromise = promise as FiberStateRejected<R>;
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
