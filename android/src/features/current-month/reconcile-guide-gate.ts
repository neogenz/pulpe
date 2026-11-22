import { useSyncExternalStore } from "react";
import { createMMKV } from "react-native-mmkv";

const SEEN_KEY = "pulpe-reconcile-guide-seen";

const storage = createMMKV({ id: "pulpe-reconcile" });

/**
 * The comparison guide opens by itself the first time the form opens on this
 * device; « ? » replays it. A plain function, so the answer is settled before
 * the first render.
 */
export function hasSeenReconcileGuide(): boolean {
  return storage.getBoolean(SEEN_KEY) ?? false;
}

const listeners = new Set<() => void>();

export function markReconcileGuideSeen(): void {
  storage.set(SEEN_KEY, true);
  listeners.forEach((listener) => listener());
}

/**
 * Same answer, kept current: the home page and a budget detail can both hold a
 * comparison sheet, and the one that did not show the guide must not show it
 * again once the other has.
 */
export function useHasSeenReconcileGuide(): boolean {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, hasSeenReconcileGuide);
}
