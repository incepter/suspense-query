import * as React from "react";

import { StateFiber, StateFiberCacheContextType } from "./types";

export const StateFiberCacheContext =
	React.createContext<StateFiberCacheContextType | null>(null);

const STATE_FIBER_GLOBAL_PROP = "__STATE_FIBER_CONTEXT__";

function getOrCreateGlobalContext() {
	let globalContext = globalThis[STATE_FIBER_GLOBAL_PROP];
	if (!globalContext) {
		let context = { cache: new Map() };
		globalThis[STATE_FIBER_GLOBAL_PROP] = context;
		return context;
	}
	return globalContext;
}

export function useStateFiberCache(): StateFiberCacheContextType {
	let context = React.useContext(StateFiberCacheContext);
	if (context === null) {
		// in client use this, in server throw that cache is required
		return getOrCreateGlobalContext().cache;
	}
	return context;
}

export function Provider({
	cache,
	children,
}: {
	children: React.ReactNode;
	cache?: Map<string, StateFiber<any, any, any>>;
}) {
	let cacheToUse = cache;
	if (!cacheToUse) {
		cacheToUse = getOrCreateGlobalContext().cache;
	}
	return (
		<StateFiberCacheContext.Provider value={cacheToUse!}>
			{children}
		</StateFiberCacheContext.Provider>
	);
}
