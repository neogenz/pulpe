import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";

const HIDDEN_KEY = "pulpe-amounts-hidden";

const storage = createMMKV({ id: "pulpe-ui-preferences" });

interface AmountVisibilityState {
  areAmountsHidden: boolean;
}

export const useAmountVisibility = create<AmountVisibilityState>(() => ({
  areAmountsHidden: storage.getBoolean(HIDDEN_KEY) === true,
}));

export function toggleAmountVisibility(): void {
  const areAmountsHidden = !useAmountVisibility.getState().areAmountsHidden;
  storage.set(HIDDEN_KEY, areAmountsHidden);
  useAmountVisibility.setState({ areAmountsHidden });
}

/**
 * Read by the formatters, which are plain functions called mid-render and so
 * cannot subscribe to anything. Screens subscribe on their behalf — see
 * `useAmountMasking`.
 */
export function areAmountsHidden(): boolean {
  return useAmountVisibility.getState().areAmountsHidden;
}

/**
 * **Every screen that prints an amount must call this.** The masking itself
 * lives in `amount-format.ts`, where one change covers every call site; what
 * it cannot do from there is ask React to repaint. This hook is that
 * subscription, and a screen missing it keeps showing figures after the
 * toggle — the one failure mode of putting the mask at the bottom.
 */
export function useAmountMasking(): void {
  useAmountVisibility((state) => state.areAmountsHidden);
}
