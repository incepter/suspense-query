import { __DEV__ } from "./shared";

export const TRANSITION = 1 as const;
export const NO_TRANSITION = 0 as const;

export type SubscriptionKind = typeof TRANSITION | typeof NO_TRANSITION;

// the following are flags subscription flags
export const DATA /*                     */ = 0b0000_0001;
export const PENDING_AWARE /*            */ = 0b0000_0010;
export const RENDERING /*                */ = 0b0000_0100;
export const PENDING /*                  */ = 0b0000_1000;
export const PENDING_TRANSITION /*       */ = 0b0001_0000;
export const COMMITTED /*                */ = 0b0010_0000;
export const ERRORED /*                  */ = 0b0100_0000;
export const SUSPENDING /*               */ = 0b1000_0000;

let devFlagsObject: Record<string, number> = {};
if (__DEV__) {
	devFlagsObject = {
		DATA: DATA,
		PENDING: PENDING,
		ERRORED: ERRORED,
		RENDERING: RENDERING,
		COMMITTED: COMMITTED,
		SUSPENDING: SUSPENDING,
		PENDING_AWARE: PENDING_AWARE,
		PENDING_TRANSITION: PENDING_TRANSITION,
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
