import * as React from "react";
import { FiberProducer, QueryToInvalidate, StateFiber } from "../types";
import { useStateFiberCache } from "../StateFiberProvider";
import { getOrCreateStateFiber, SuspenseDispatcher } from "../StateFiber";
import { useSubscribeToFiber } from "./useSubscribe";
import { NO_TRANSITION } from "../StateFiberFlags";

export function useMutation<T, A extends unknown[], R>(
	mutation: FiberProducer<T, A, R>,
	queriesToInvalidate?: QueryToInvalidate<any, any, any>[]
) {
	let cache = useStateFiberCache();
	let fiber = getOrCreateStateFiber<T, A, R>(cache, mutation);

	let subscription = useSubscribeToFiber(NO_TRANSITION, fiber);

	return function (...args: A) {
		let prevFiberDeps = fiber.dependencies;
		let prevTransitionFn = SuspenseDispatcher.startTransition;

		fiber.dependencies = (queriesToInvalidate || null);
		SuspenseDispatcher.startTransition = subscription.start;

		fiber.run.apply(null, args);

		fiber.dependencies = prevFiberDeps;
		SuspenseDispatcher.startTransition = prevTransitionFn;
	};
}
