import { act, renderHook } from "@testing-library/react-native";

import {
  hasSeenReconcileGuide,
  markReconcileGuideSeen,
  useHasSeenReconcileGuide,
} from "./reconcile-guide-gate";

jest.mock("react-native-mmkv", () => {
  const storage = new Map<string, boolean>();
  return {
    createMMKV: () => ({
      getBoolean: (key: string) => storage.get(key),
      set: (key: string, value: boolean) => storage.set(key, value),
    }),
  };
});

describe("reconcile guide gate", () => {
  it("is unseen until marked, then tells every mounted reader at once", async () => {
    expect(hasSeenReconcileGuide()).toBe(false);
    const first = await renderHook(() => useHasSeenReconcileGuide());
    const second = await renderHook(() => useHasSeenReconcileGuide());
    expect([first.result.current, second.result.current]).toEqual([
      false,
      false,
    ]);

    await act(() => markReconcileGuideSeen());

    expect(hasSeenReconcileGuide()).toBe(true);
    expect([first.result.current, second.result.current]).toEqual([true, true]);
  });
});
