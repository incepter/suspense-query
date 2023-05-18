import { __DEV__ } from "./shared";

export const TRANSITION = 1 as const;
export const NO_TRANSITION = 0 as const;

export type SubscriptionKind = typeof TRANSITION | typeof NO_TRANSITION;

// the following are flags subscription flags
export const SUSPENDING /*               */ = 0b0000_0001;
export const COMMITTED /*                */ = 0b0000_0010;

let devFlagsObject: Record<string, number> = {};
if (__DEV__) {
	devFlagsObject = {
		COMMITTED: COMMITTED,
		SUSPENDING: SUSPENDING,
	};
}
export function humanizeFlags(flags: number) {
	if (__DEV__) {
		let output: string[] = [];
		for (let [name, value] of Object.entries(devFlagsObject)) {
			if (value & flags) {
				output.push(name);
			}
		}

		return output;
	}
}
