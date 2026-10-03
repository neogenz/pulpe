import { renderHook } from "@testing-library/react-native";
import { router } from "expo-router";

import { usePushOnce } from "./push-once";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date(2026, 9, 1) });
});

afterEach(() => jest.useRealTimers());

it("pushes a screen once for a double tap", async () => {
  const { result } = await renderHook(() => usePushOnce());

  result.current("/budget/b-1");
  result.current("/budget/b-1");

  expect(router.push).toHaveBeenCalledTimes(1);
});

it("still navigates to another screen, or to the same one a moment later", async () => {
  const { result } = await renderHook(() => usePushOnce());

  result.current("/budget/b-1");
  result.current("/budget/b-2");
  jest.advanceTimersByTime(1000);
  result.current("/budget/b-1");

  expect(router.push).toHaveBeenCalledTimes(3);
});
