import * as React from "react";
import { FiberProducer, UseQueryControlReturn } from "../types";
import { useStateFiberCache } from "../StateFiberProvider";
import { getOrCreateStateFiber, SuspenseDispatcher } from "../StateFiber";
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
			setData(data: T) {
				let prevTransitionFn = SuspenseDispatcher.startTransition;

				SuspenseDispatcher.startTransition = start;
				fiber.setData(data);
				SuspenseDispatcher.startTransition = prevTransitionFn;
			},
			setError(error: R) {
				let prevTransitionFn = SuspenseDispatcher.startTransition;

				SuspenseDispatcher.startTransition = start;
				fiber.setError(error);
				SuspenseDispatcher.startTransition = prevTransitionFn;
			},
			run(...args: A) {
				let prevTransitionFn = SuspenseDispatcher.startTransition;

				SuspenseDispatcher.startTransition = start;
				fiber.run.apply(null, args);
				SuspenseDispatcher.startTransition = prevTransitionFn;
			},
		}),
		[fiber, start, isPending]
	);
}
