import type { TransactionKind } from "pulpe-shared";
import { createMMKV } from "react-native-mmkv";

import { captureFirstTransactionCreated } from "@/core/observability/product-events";

/** Where a movement was recorded: the value space of `source`, shared with iOS and the web. */
export type FirstMovementSource =
  | "activation_prompt"
  | "add_button"
  | "budget_details"
  | "reconciliation";

const RECORDED_KEY = "has-recorded-first-movement";

const storage = createMMKV({ id: "pulpe-first-movement" });

/**
 * Mirrors `FirstTransactionTracker.swift`: whether the account has recorded
 * anything yet, asked of the server so another device's entries count.
 * `null` is unknown, and an unknown account never emits.
 */
let hasMovement: boolean | null = null;
let loading: Promise<void> | null = null;

// Loaded on demand: the identity reset reaches this module from the session
// store, which must not pull the API client in with it.
async function fetchHasMovement(): Promise<boolean> {
  const { fetchHasTransaction } = await import("./transaction-api");
  return fetchHasTransaction();
}

/**
 * Ask once, before the first create: afterwards the server answers "yes"
 * whatever happened. A failed ask leaves the answer unknown.
 */
export function loadFirstMovementState(
  fetchExists: () => Promise<boolean> = fetchHasMovement,
): Promise<void> {
  if (hasMovement !== null) return Promise.resolve();
  if (storage.getBoolean(RECORDED_KEY) === true) {
    hasMovement = true;
    return Promise.resolve();
  }
  loading ??= fetchExists()
    .then((answer) => {
      // An entry recorded meanwhile already answered.
      hasMovement ??= answer;
    })
    .catch(() => undefined)
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Call once the server accepted the movement. */
export function recordMovementCreated(
  kind: TransactionKind,
  source: FirstMovementSource,
): void {
  if (hasMovement === false) captureFirstTransactionCreated(kind, source);
  hasMovement = true;
  storage.set(RECORDED_KEY, true);
}

/** Identity boundary: the next account starts from its own answer. */
export function resetFirstMovementTracker(): void {
  hasMovement = null;
  loading = null;
  storage.remove(RECORDED_KEY);
}
