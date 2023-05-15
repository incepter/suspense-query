import { FiberProducer, QueryToInvalidate } from "../types";
import { useStateFiberCache } from "../StateFiberProvider";
import {
	getOrCreateStateFiber,
	runStateFiber,
	SuspenseDispatcher,
} from "../StateFiber";
import { useSubscribeToFiber } from "./useSubscribe";
import { NO_TRANSITION } from "../StateFiberFlags";

export function useMutation<T, A extends unknown[], R>(
	mutation: FiberProducer<T, A, R>,
	queriesToInvalidate?: QueryToInvalidate<any, any, any>[]
): [(...args: A) => void, boolean] {
	let cache = useStateFiberCache();
	let fiber = getOrCreateStateFiber<T, A, R>(cache, mutation);

	let subscription = useSubscribeToFiber(NO_TRANSITION, fiber);

	function run(...args: A) {
		let prevFiberDeps = fiber.dependencies;
		let prevTransitionFn = SuspenseDispatcher.startTransition;

		fiber.dependencies = queriesToInvalidate || null;
		SuspenseDispatcher.startTransition = subscription.start;

		runStateFiber(fiber, args);

		fiber.dependencies = prevFiberDeps;
		SuspenseDispatcher.startTransition = prevTransitionFn;
	}

	return [run, !!fiber.alternate];
}
