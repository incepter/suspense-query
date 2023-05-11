import React from "react";
import { DATA, PENDING_AWARE, SubscriptionKind } from "./SubscriptionKind";

export type StateFiberCacheContextType = Map<string, StateFiber<any, any, any>>;

export interface FiberStatePending<T, R> extends Promise<T> {
	status: "pending";
	abort?: RunReturn<T, R>;
}

export type FiberPromise<T, R> =
	| FiberStatePending<T, R>
	| FiberStateFulfilled<T>
	| FiberStateRejected<R>;

export interface FiberStateFulfilled<T> extends Promise<T> {
	value: T;
	status: "fulfilled";
}

export interface FiberStateRejected<R> extends Promise<R> {
	reason: R;
	status: "rejected";
}

export type FiberState<T, R> = FiberStateFulfilled<T> | FiberStateRejected<R>;

export type FiberRetainers<T, A extends unknown[], R> = Map<
	React.Dispatch<React.SetStateAction<number>>,
	StateFiberListener<T, A, R>
>;

export interface StateFiber<T, A extends unknown[], R> {
	name: string;
	config: StateFiberConfig<T, A, R>;
	cache: Map<A, FiberState<T, R>> | null;

	args: A | null;
	current: FiberState<T, R> | null;
	alternate: FiberStatePending<T, R> | null;
	retainers: {
		[DATA]: FiberRetainers<T, A, R> | null;
		[PENDING_AWARE]: FiberRetainers<T, A, R> | null;
	};

	setData(data: T): void;

	setError(error: R): void;

	run(...args: A): RunReturn<T, R>;

	retain(
		kind: SubscriptionKind,
		update: React.Dispatch<React.SetStateAction<number>>,
		startTransition: React.TransitionStartFunction,
		isPending: boolean
	): StateFiberListener<T, A, R>;

	// evictAll(): void;
	// evict(...args: A): void;
}

export type FiberWithoutSource<T, A extends unknown[], R> = Omit<
	StateFiber<T, A, R>,
	"source" | "run" | "setData" | "setError" | "retain"
>;

export type StateFiberListener<T, A extends unknown[], R> = {
	at?: string; // dev mode
	pending: boolean;
	clean: () => void;
	kind: SubscriptionKind;
	// run: (...args: A) => RunReturn<T, R>;
	start: React.TransitionStartFunction;
	update: React.Dispatch<React.SetStateAction<number>>;
};

export interface StateFiberConfig<T, A extends unknown[], R> {
	initialValue?: T;

	enableCache?: boolean;

	deadline?(data: T): number;

	skipPendingUnderMs?: number;
	keepPendingAtLeastMs?: number;

	effectDurationMs?: number;
	effect?: "debounce" | "throttle";

	fn?: FiberProducer<T, A, R>;
}

export interface UseDataOptions<T, A extends unknown[], R>
	extends StateFiberConfig<T, A, R> {
	initialArgs?: A;
	args?: A;
}

export type FiberProducer<T, A extends unknown[], R> = (
	...args: A
) => T | Promise<T>;

export type RunReturn<T, R> = {
	(reason?: R): void;
	promise: Promise<T>;
};

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
