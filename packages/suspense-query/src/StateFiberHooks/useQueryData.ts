import { useSubscribeToFiber } from "./useSubscribe";
import { FiberProducer, StateFiber, UseDataOptions } from "../types";
import { useStateFiberCache } from "../StateFiberProvider";
import {
	addSuspendingPromise,
	getOrCreateStateFiber,
	removeSuspendingPromise,
	runStateFiber,
	suspendingPromises,
	SuspenseDispatcher,
	tagFulfilled,
} from "../StateFiber";
import { __DEV__, didDepsChange, emptyArray, hasOwnProp } from "../shared";
import { RENDERING, SUSPENDING, TRANSITION } from "../StateFiberFlags";
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
	if (fiber.alternate !== null && fiber.current === null) {
		// this branch means that we will be suspending next
		// when suspending, this subscription doesn't appear in the listeners Map
		// because effects aren't triggerred. If it appears and is updated, react
		// will warn that this component isn't mounted, so its update should be called.
		// to sync the very first transition outside the current suspense boundary
		// (aka via useQueryControls), we ll commit imperatively here this subscription
		// then, queryControls won't transition to resolved status unless
		// this component renders back from suspending.
		// rendering back from suspense isn't guaranteed, we'll need to evict it
		// or keep it in another place.
		addSuspendingPromise(fiber.alternate);
		subscription.flags |= SUSPENDING;
	}

	let result = reactUse(fiber.alternate || fiber.current);

	if (suspendingPromises.has(fiber.current!)) {
		// this means that this component rendered successfully after suspending
		// and his promise resolved.
		// now we will tag this subscription that will be committed by the
		// SUSPENDING tag, so it s clear that it rendered back from suspending and
		// that we need to sync it to other subscribers.
		// remove any suspender from the retainers list, we are re-rendering again.
		// todo: flush updateQueue if there are no retainers
		subscription.flags |= SUSPENDING;
		removeSuspendingPromise(fiber.current);
	}

	return result;
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
			fiber.current = tagFulfilled(Promise.resolve(init), init);
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
		runStateFiber(fiber, args);
	} finally {
		SuspenseDispatcher.isRenderPhaseRun = prevIsRenderPhaseRun;
	}
}
