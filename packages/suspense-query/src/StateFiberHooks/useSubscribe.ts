import * as React from "react";
import {
	COMMITTED,
	SubscriptionKind,
	SUSPENDING,
	TRANSITION,
} from "../StateFiberFlags";
import { StateFiber, StateFiberListener } from "../types";
import { flushQueueAndNotifyListeners, retain } from "../StateFiber";
import { defaultUpdater } from "../shared";

export function useSubscribeToFiber<T, A extends unknown[], R>(
	kind: SubscriptionKind,
	fiber: StateFiber<T, A, R>
) {
	let forceUpdate = React.useState(0)[1];
	let [, _start] = React.useTransition();
	let subscription = retain(fiber, kind, forceUpdate, _start);

	let snapshot = fiber.current;
	React.useLayoutEffect(() =>
		commitSubscription(fiber, subscription, snapshot)
	);
	return subscription;
}

export function commitSubscription<T, A extends unknown[], R>(
	fiber: StateFiber<T, A, R>,
	subscription: StateFiberListener<T, A, R>,
	snapshot: StateFiber<T, A, R>["current"]
) {
	if (fiber.current !== snapshot) {
		subscription.update(defaultUpdater);
		return;
	}
	if (!fiber.retainers[subscription.kind]) {
		fiber.retainers[subscription.kind] = new Map();
	}

	let actualRetainers = fiber.retainers[subscription.kind]!;
	actualRetainers.set(subscription.update, subscription);

	subscription.flags |= COMMITTED;

	if ((subscription.flags &= SUSPENDING)) {
		subscription.flags &= ~SUSPENDING;
		// remove other suspending retainers, or just the previous suspending retain
		fiber.retainers[TRANSITION]?.forEach((sub) => {
			if ((sub.flags |= SUSPENDING) && !(sub.flags |= COMMITTED)) {
				sub.clean();
			}
		});

		// todo: add deps to queue so that we don't mess things here
		flushQueueAndNotifyListeners(fiber);
	}

	return () => {
		subscription.clean();
		subscription.flags &= ~COMMITTED;
	};
}
