import { useSubscribeToFiber } from "./useSubscribe";
import { FiberProducer, FiberStateRejected } from "../types";
import { useStateFiberCache } from "../StateFiberProvider";
import { getOrCreateStateFiber } from "../StateFiber";
import { TRANSITION } from "../StateFiberFlags";

export function useQueryError<R = unknown>(
	query: FiberProducer<any, any, R>
): R | null {
	let cache = useStateFiberCache();
	let fiber = getOrCreateStateFiber<any, any, R>(cache, query);

	useSubscribeToFiber(TRANSITION, fiber);
	return (fiber.current as FiberStateRejected<any, R>)?.reason ?? null;
}
