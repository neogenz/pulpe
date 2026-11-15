import Constants from "expo-constants";
import { AppState } from "react-native";
import { createMMKV } from "react-native-mmkv";

import { captureStoreReviewRequested } from "@/core/observability/product-events";

/**
 * Mirrors `StoreReviewPrompt.swift`: asks for a Play Store rating after the
 * fifth movement recorded since the last request, at most once per app
 * version, never at launch. Nothing is asked beforehand: filtering who sees
 * the card is review gating, which Google forbids. Play caps how often the
 * card shows and never says whether it did.
 */
export const MOVEMENTS_BEFORE_REQUEST = 5;

const COUNT_KEY = "movement-count";
const VERSION_KEY = "last-requested-version";

const storage = createMMKV({ id: "pulpe-store-review" });
let isRequesting = false;

interface StoreReviewDependencies {
  appVersion?: string;
  waitForCalmMoment?: () => Promise<void>;
  /** Resolves `false` when no card could be asked for, so the next movement retries. */
  requestReview?: () => Promise<boolean>;
}

/** The add sheet is still closing when the movement lands. */
function waitTwoSeconds(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2000));
}

async function requestPlayReview(): Promise<boolean> {
  if (AppState.currentState !== "active") return false;
  try {
    // Loaded on demand: an over-the-air update can reach a binary built
    // before this native module existed, and a top-level import would crash it.
    const StoreReview = await import("expo-store-review");
    if (!(await StoreReview.isAvailableAsync())) return false;
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}

/** Call once the server accepted a new movement. */
export async function recordMovementForStoreReview({
  appVersion = Constants.expoConfig?.version ?? "",
  waitForCalmMoment = waitTwoSeconds,
  requestReview = requestPlayReview,
}: StoreReviewDependencies = {}): Promise<void> {
  const count = (storage.getNumber(COUNT_KEY) ?? 0) + 1;
  storage.set(COUNT_KEY, count);
  if (
    isRequesting ||
    count < MOVEMENTS_BEFORE_REQUEST ||
    storage.getString(VERSION_KEY) === appVersion
  ) {
    return;
  }
  isRequesting = true;
  try {
    await waitForCalmMoment();
    if (!(await requestReview())) return;
    storage.set(VERSION_KEY, appVersion);
    storage.set(COUNT_KEY, 0);
    captureStoreReviewRequested("automatic");
  } finally {
    isRequesting = false;
  }
}
