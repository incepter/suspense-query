import { useStateFiberCache } from "../StateFiberProvider";
import { FiberProducer, StateFiber, StateFiberCache } from "../types";
import { runStateFiber } from "../StateFiber";

export function useRun<T, A extends unknown[], R>(): (
	query: FiberProducer<T, A, R>,
	args: A
) => void {
	let cache = useStateFiberCache();

	return (runRegisteredQuery as typeof runRegisteredQuery<T, A, R>).bind(
		null,
		cache
	);
}

function runRegisteredQuery<T, A extends unknown[], R>(
	cache: StateFiberCache,
	query: FiberProducer<T, A, R>,
	args: A
) {
	let maybeFiber = cache.get(query);
	if (!maybeFiber) {
		throw new Error("Query not found");
	}
	let fiber = maybeFiber as StateFiber<T, A, R>;
	runStateFiber(fiber, args);
}
