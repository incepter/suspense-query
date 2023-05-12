import * as React from "react";
import {
	FiberStateRejected,
	StateFiber,
	StateFiberListener,
	UseDataOptions,
	UseQueryControlReturn,
} from "./types";
import { useStateFiberCache } from "./StateFiberProvider";
import {
	getOrCreateStateFiber,
	SuspenseDispatcher,
	tagFulfilledPromise,
} from "./StateFiber";
import { __DEV__, didDepsChange, emptyArray, hasOwnProp } from "./shared";
import { reactUse } from "./Use";
import {
	COMMITTED,
	NO_TRANSITION,
	SubscriptionKind,
	RENDERING,
	TRANSITION,
	humanizeFlags,
} from "./StateFiberFlags";

let didWarnAboutUsingBothArgsAndInitialArgs = false;

function useSubscribeToFiber<T, A extends unknown[], R>(
	kind: SubscriptionKind,
	fiber: StateFiber<T, A, R>
) {
	let forceUpdate = React.useState(0)[1];
	let [isPending, _start] = React.useTransition();
	let subscription = fiber.retain(kind, forceUpdate, _start, isPending);

	React.useLayoutEffect(() => commitSubscription(fiber, subscription));
	return subscription;
}

export function useQueryData<T, A extends unknown[], R>(
	name: string,
	options?: UseDataOptions<T, A, R>
): T {
	let cache = useStateFiberCache();
	let fiber = getOrCreateStateFiber<T, A, R>(cache, name, options);

	if (__DEV__) {
		warnInDevAboutIncompatibleOptions(fiber, options);
	}

	renderFiber(fiber, options);
	let subscription = useSubscribeToFiber(TRANSITION, fiber);

	if (!(fiber.alternate || fiber.current)) {
		throw new Error(`Query with name ${name} has no initial value.`);
	}

	subscription.flags |= RENDERING;

	console.log(
		"useQueryDataFlags",
		subscription.at,
		humanizeFlags(subscription.flags)
	);
	return reactUse(fiber.alternate || fiber.current);
}

export function useQueryError<R = unknown>(name: string): R | null {
	let cache = useStateFiberCache();
	let fiber = getOrCreateStateFiber<any, any, R>(cache, name);

	useSubscribeToFiber(TRANSITION, fiber);
	return (fiber.current as FiberStateRejected<any, R>)?.reason ?? null;
}

export function useQueryControl<
	T,
	A extends unknown[] = unknown[],
	R = unknown
>(name: string): UseQueryControlReturn<T, A, R> {
	let cache = useStateFiberCache();
	let fiber = getOrCreateStateFiber<T, A, R>(cache, name);

	let isPending = !!fiber.alternate;
	let { start } = useSubscribeToFiber(NO_TRANSITION, fiber);

	return React.useMemo(
		() => ({
			isPending,
			setData(data: T) {
				let prevTransitionFn = SuspenseDispatcher.startTransition;

				SuspenseDispatcher.startTransition = start;
				fiber.setData(data);
				SuspenseDispatcher.startTransition = prevTransitionFn;
			},
			setError(error: R) {
				let prevTransitionFn = SuspenseDispatcher.startTransition;

				SuspenseDispatcher.startTransition = start;
				fiber.setError(error);
				SuspenseDispatcher.startTransition = prevTransitionFn;
			},
			run(...args: A) {
				let prevTransitionFn = SuspenseDispatcher.startTransition;

				SuspenseDispatcher.startTransition = start;
				fiber.run.apply(null, args);
				SuspenseDispatcher.startTransition = prevTransitionFn;
			},
		}),
		[fiber, start, isPending]
	);
}

function renderFiber<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	options: UseDataOptions<T, A, R> | undefined
) {
	if (fiber.current === null && fiber.alternate === null) {
		let args = ((options && (options.args || options.initialArgs)) ||
			emptyArray) as A;
		mountStateFiber(fiber, args);
	} else if (options && options.args) {
		let args = options.args;
		if (didDepsChange(fiber.args!, args)) {
			updateStateFiber(fiber, args);
		}
	}
}
function mountStateFiber<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	args: A
): void {
	let config = fiber.config;
	if (!config.fn) {
		let init = config.initialValue;
		if (init !== undefined) {
			fiber.alternate = null;
			fiber.current = tagFulfilledPromise(Promise.resolve(init), init);
		}
	} else {
		runFiberFunctionOnRender(fiber, args);
	}
}

function updateStateFiber<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	args: A
): void {
	let config = fiber.config;
	if (!config.fn) {
		// do nothing when there is no producer on update
		// it will be used via setData and setError
		return;
	} else {
		runFiberFunctionOnRender(fiber, args);
	}
}

function commitSubscription<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	subscription: StateFiberListener<T, A, R>
) {
	if (!fiber.retainers[subscription.kind]) {
		fiber.retainers[subscription.kind] = new Map();
	}

	let actualRetainers = fiber.retainers[subscription.kind]!;
	actualRetainers.set(subscription.update, subscription);

	subscription.flags |= COMMITTED;
	return () => {
		subscription.clean();
		subscription.flags &= ~COMMITTED;
	};
}

function warnInDevAboutIncompatibleOptions(
	fiber: StateFiber<any, any, any>,
	options?: UseDataOptions<any, any, any>
) {
	if (options) {
		if (!didWarnAboutUsingBothArgsAndInitialArgs) {
			if (
				fiber.current && // already mounted
				hasOwnProp.call(options, "args") &&
				hasOwnProp.call(options, "initialArgs")
			) {
				console.error(
					"You cannot use 'args' and 'initialArgs' at the same " +
						"time when using useData(name, options?)."
				);
				didWarnAboutUsingBothArgsAndInitialArgs = true;
			}
		}
	}
}

function runFiberFunctionOnRender<T, A extends unknown[], R>(
	fiber: StateFiber<any, any, any>,
	args: A
) {
	let prevIsRenderPhaseRun = SuspenseDispatcher.isRenderPhaseRun;

	try {
		SuspenseDispatcher.isRenderPhaseRun = true;
		fiber.run.apply(null, args);
	} finally {
		SuspenseDispatcher.isRenderPhaseRun = prevIsRenderPhaseRun;
	}
}
