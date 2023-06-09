export function isPromise<T>(p: any): p is Promise<T> {
	return p && typeof p.then === "function";
}

export const assign = Object.assign;
export const emptyArray = Object.freeze([]);
export const defaultUpdater = (prev) => prev + 1;
export const hasOwnProp = Object.prototype.hasOwnProperty;
export const __DEV__ = process.env.NODE_ENV !== "production";

export function resolveComponentName() {
	const stackTrace = new Error().stack;
	if (!stackTrace) {
		return undefined;
	}

	const regex = new RegExp(/at.(\w+).*$/, "gm");
	let match = regex.exec(stackTrace);

	let i = 0;
	while (i < 4 && match) {
		match = regex.exec(stackTrace);

		i += 1;
	}

	return match?.[1];
}

export function didDepsChange(deps: any[], deps2: any[]) {
	if (deps.length !== deps2.length) {
		return true;
	}
	for (let i = 0, { length } = deps; i < length; i += 1) {
		if (!Object.is(deps[i], deps2[i])) {
			return true;
		}
	}
	return false;
}
