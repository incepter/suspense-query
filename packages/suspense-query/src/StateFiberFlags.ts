export const DATA = 1 as const;
export const PENDING_AWARE = 0 as const;

export type SubscriptionKind = typeof DATA | typeof PENDING_AWARE;
