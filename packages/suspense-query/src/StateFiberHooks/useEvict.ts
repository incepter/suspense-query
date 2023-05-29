import * as React from "react";
import { useStateFiberCache } from "../StateFiberProvider";
import { evictFiberCurrentState, getOrCreateStateFiber } from "../StateFiber";

export function useEvict(query: (...args: any[]) => any): () => void {
	let cache = useStateFiberCache();
	let fiber = getOrCreateStateFiber(cache, query);

  return evictFiberCurrentState.bind(null, fiber);
}
