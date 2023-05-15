import React from "react";
import { NO_TRANSITION, SubscriptionKind, TRANSITION } from "./StateFiberFlags";

export type StateFiberCache = Map<
	FiberProducer<any, any, any>,
	StateFiber<any, any, any>
>;

export interface FiberStatePending<T, R> extends Promise<T> {
	status: "pending";
	abort?: RunReturn<T, R>;
}

export type FiberPromise<T, R> =
	| FiberStatePending<T, R>
	| FiberStateFulfilled<T>
	| FiberStateRejected<T, R>;

export interface FiberStateFulfilled<T> extends Promise<T> {
	value: T;
	status: "fulfilled";
}

export interface FiberStateRejected<T, R> extends Promise<T> {
	reason: R;
	status: "rejected";
}

export type FiberState<T, R> =
	| FiberStateFulfilled<T>
	| FiberStateRejected<T, R>;

export type FiberRetainers<T, A extends unknown[], R> = Map<
	React.Dispatch<React.SetStateAction<number>>,
	StateFiberListener<T, A, R>
>;

export type FiberUpdateQueue<T, A extends unknown[], R> = {
	args: A;
	update: FiberPromise<T, R>;
	next: FiberUpdateQueue<T, A, R> | null;
};

export type QueryToInvalidate<T, A extends unknown[], R> =
	| {
			query: FiberProducer<T, A, R>;
			args: A;
	  }
	| FiberProducer<T, A, R>;

export interface StateFiber<T, A extends unknown[], R> {
	root: StateFiberCache;

	name?: string;
	query: FiberProducer<T, A, R>;
	config: StateFiberConfig<T, A, R>;


	updateQueue: FiberUpdateQueue<T, A, R> | null;
	dependencies: QueryToInvalidate<any, any, any>[] | null;

	args: A | null;
	current: FiberState<T, R> | null;
	alternate: FiberStatePending<T, R> | null;
	retainers: {
		[TRANSITION]: FiberRetainers<T, A, R> | null;
		[NO_TRANSITION]: FiberRetainers<T, A, R> | null;
	};

	// evictAll(): void;
	// evict(...args: A): void;
}

export type StateFiberListener<T, A extends unknown[], R> = {
	at?: string; // dev mode, component or hook name
	flags: number;
	clean: () => void;
	kind: SubscriptionKind;
	start: React.TransitionStartFunction;
	update: React.Dispatch<React.SetStateAction<number>>;
};

export interface StateFiberConfig<T, A extends unknown[], R> {
	name?: string;
	initialValue?: T;

	enableCache?: boolean;

	deadline?(data: T): number;

	skipPendingUnderMs?: number;
	keepPendingAtLeastMs?: number;

	effectDurationMs?: number;
	effect?: "debounce" | "throttle";
}

export interface UseDataOptions<T, A extends unknown[], R>
	extends StateFiberConfig<T, A, R> {
	initialArgs?: A;
	args?: A;
}

export type FiberProducer<T, A extends unknown[], R> = (
	...args: A
) => T | Promise<T>;

export type RunReturn<T, R> = void;
// {
// 	(reason?: R): void;
// 	promise: Promise<T>;
// };

export interface UseQueryControlReturn<
	T,
	A extends unknown[] = unknown[],
	R = unknown
> {
	setData(data: T): void;

	setError(error: R): void;

	run(...args: A): RunReturn<T, R>;

	isPending: boolean;
}

export interface PromiseWithOptionalStatus extends Promise<any> {
	status?: "pending" | "fulfilled" | "rejected";
}
