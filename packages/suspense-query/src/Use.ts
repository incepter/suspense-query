import * as React from "react";
import {
	FiberPromise,
	FiberStateFulfilled,
	FiberStatePending,
	FiberStateRejected,
	PromiseWithOptionalStatus,
} from "./types";
import { tagFulfilledPromise, tagRejectedPromise } from "./StateFiber";

// @ts-expect-error React.use type
export const reactUse = React.use || useShim;

function useShim<T, R>(promise: Promise<T>) {
	const thenable = promise as FiberPromise<T, R> | PromiseWithOptionalStatus;
	switch (thenable.status) {
		case "fulfilled": {
			return (thenable as FiberStateFulfilled<T>).value;
		}
		case "rejected": {
			throw (thenable as FiberStateRejected<R>).reason;
		}
		default: {
			if (typeof thenable.status !== "string") {
				const pendingThenable = thenable as FiberStatePending<T, R>;
				pendingThenable.status = "pending";
				pendingThenable.then(
					(fulfilledValue) => {
						if (thenable.status === "pending") {
							tagFulfilledPromise(thenable, fulfilledValue);
						}
						return fulfilledValue;
					},
					(error: R) => {
						if (thenable.status === "pending") {
							tagRejectedPromise(thenable, error);
						}
						throw error;
					}
				);

				switch ((thenable as FiberPromise<T, R>).status) {
					case "fulfilled": {
						return (thenable as FiberStateFulfilled<T>).value;
					}
					case "rejected": {
						throw (thenable as FiberStateRejected<R>).reason;
					}
				}
			}
		}
	}
	throw thenable;
}
