import * as React from "react";
import { COMMITTED, SubscriptionKind } from "../StateFiberFlags";
import { StateFiber, StateFiberListener } from "../types";
import { retain } from "../StateFiber";

export function useSubscribeToFiber<T, A extends unknown[], R>(
	kind: SubscriptionKind,
	fiber: StateFiber<T, A, R>
) {
	let forceUpdate = React.useState(0)[1];
	let [isPending, _start] = React.useTransition();
	let subscription = retain(fiber, kind, forceUpdate, _start, isPending);

	React.useLayoutEffect(() => commitSubscription(fiber, subscription));
	return subscription;
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
