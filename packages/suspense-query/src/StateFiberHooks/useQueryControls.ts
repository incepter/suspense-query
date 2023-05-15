import * as React from "react";
import { FiberProducer, StateFiber, UseQueryControlReturn } from "../types";
import { useStateFiberCache } from "../StateFiberProvider";
import {
	applyUpdate,
	getOrCreateStateFiber,
	runStateFiber,
	SuspenseDispatcher,
	tagFulfilled,
	tagRejected,
} from "../StateFiber";
import { NO_TRANSITION } from "../StateFiberFlags";
import { useSubscribeToFiber } from "./useSubscribe";

export function useQueryControls<
	T,
	A extends unknown[] = unknown[],
	R = unknown
>(query: FiberProducer<T, A, R>): UseQueryControlReturn<T, A, R> {
	let cache = useStateFiberCache();
	let fiber = getOrCreateStateFiber<T, A, R>(cache, query);

	let isPending = !!fiber.alternate;
	let { start } = useSubscribeToFiber(NO_TRANSITION, fiber);

	return React.useMemo(
		() => ({
			isPending,
			run: (runFiber as typeof runFiber<T, A, R>).bind(null, fiber, start),
			setData: (setData as typeof setData<T, A, R>).bind(null, fiber, start),
			setError: (setError as typeof setError<T, A, R>).bind(null, fiber, start),
		}),
		[fiber, start, isPending]
	);
}

function setData<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	startTransition: React.TransitionStartFunction,
	data: T
) {
	let prevTransitionFn = SuspenseDispatcher.startTransition;

	SuspenseDispatcher.startTransition = startTransition;
	applyUpdate(
		fiber,
		[data] as A,
		tagFulfilled(Promise.resolve(data), data),
		fiber.dependencies
	);
	SuspenseDispatcher.startTransition = prevTransitionFn;
}

function setError<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	startTransition: React.TransitionStartFunction,
	error: R
) {
	let prevTransitionFn = SuspenseDispatcher.startTransition;

	SuspenseDispatcher.startTransition = startTransition;
	applyUpdate(
		fiber,
		[error] as A,
		tagRejected(Promise.reject(error), error),
		fiber.dependencies
	);
	SuspenseDispatcher.startTransition = prevTransitionFn;
}

function runFiber<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	startTransition: React.TransitionStartFunction,
	...args: A
) {
	let prevTransitionFn = SuspenseDispatcher.startTransition;

	SuspenseDispatcher.startTransition = startTransition;
	runStateFiber(fiber, args);
	SuspenseDispatcher.startTransition = prevTransitionFn;
}
