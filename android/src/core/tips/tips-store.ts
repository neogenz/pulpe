import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";

/**
 * The four things the app cannot make obvious by looking at it. Mirrors the
 * iOS TipKit set (`ios/Pulpe/Features/Tips/ProductTips.swift`), minus its
 * display-count rules: here each one shows once and never comes back.
 */
export type TipId =
  | "gestures"
  | "checking"
  | "pessimistic-check"
  | "templates-web-parity";

const DISMISSED_KEY = "pulpe-tips-dismissed";
const ARMED_KEY = "pulpe-tips-armed";

const storage = createMMKV({ id: "pulpe-tips" });

interface TipsState {
  dismissedIds: TipId[];
  /** Tips that wait for something to happen before they have anything to say. */
  armedIds: TipId[];
}

function readIds(key: string): TipId[] {
  const raw = storage.getString(key);
  if (raw === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TipId[]) : [];
  } catch {
    return [];
  }
}

export const useTipsStore = create<TipsState>(() => ({
  dismissedIds: readIds(DISMISSED_KEY),
  armedIds: readIds(ARMED_KEY),
}));

/**
 * Marks a tip as answered — whether the user closed it or simply did the thing
 * it was about to explain, which is the better outcome of the two.
 */
export function dismissTip(id: TipId): void {
  const { dismissedIds } = useTipsStore.getState();
  if (dismissedIds.includes(id)) return;

  const next = [...dismissedIds, id];
  storage.set(DISMISSED_KEY, JSON.stringify(next));
  useTipsStore.setState({ dismissedIds: next });
}

/**
 * Lets a tip appear from now on. Only for the ones that would be noise before
 * the user has met the situation they describe.
 */
export function armTip(id: TipId): void {
  const { armedIds } = useTipsStore.getState();
  if (armedIds.includes(id)) return;

  const next = [...armedIds, id];
  storage.set(ARMED_KEY, JSON.stringify(next));
  useTipsStore.setState({ armedIds: next });
}

export function useIsTipArmed(id: TipId): boolean {
  return useTipsStore((state) => state.armedIds.includes(id));
}
