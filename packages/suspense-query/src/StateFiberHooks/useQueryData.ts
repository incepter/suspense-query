import { useSubscribeToFiber } from "./useSubscribe";
import { FiberProducer, StateFiber, UseDataOptions } from "../types";
import { useStateFiberCache } from "../StateFiberProvider";
import {
	getOrCreateStateFiber,
	SuspenseDispatcher,
	tagFulfilledPromise,
} from "../StateFiber";
import { __DEV__, didDepsChange, emptyArray, hasOwnProp } from "../shared";
import { RENDERING, TRANSITION } from "../StateFiberFlags";
import { reactUse } from "../Use";

let didWarnAboutUsingBothArgsAndInitialArgs = false;

export function useQueryData<T, A extends unknown[], R>(
	query: FiberProducer<T, A, R>,
	options?: UseDataOptions<T, A, R>
): T {
	let cache = useStateFiberCache();
	let fiber = getOrCreateStateFiber<T, A, R>(cache, query, options);

	if (__DEV__) {
		warnInDevAboutIncompatibleOptions(fiber, options);
	}

	renderFiber(fiber, options);
	let subscription = useSubscribeToFiber(TRANSITION, fiber);

	if (!(fiber.alternate || fiber.current)) {
		if (__DEV__) {
			console.error(`Query at ${subscription.at} has no initial value.`, query);
		}
		throw new Error(`Query has no initial value.`);
	}

	subscription.flags |= RENDERING;
	return reactUse(fiber.alternate || fiber.current);
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
	if (!fiber.query) {
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
	if (!fiber.query) {
		// do nothing when there is no producer on update
		// it will be used via setData and setError
		return;
	} else {
		runFiberFunctionOnRender(fiber, args);
	}
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
