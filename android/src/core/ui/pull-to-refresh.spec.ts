import { act, renderHook } from "@testing-library/react-native";

import { usePullToRefresh } from "./pull-to-refresh";

it("spins for the pull it answers, and stops when the refresh settles", async () => {
  let finish!: () => void;
  const refresh = jest.fn(
    () => new Promise<void>((resolve) => (finish = resolve)),
  );
  const { result } = await renderHook(() => usePullToRefresh(refresh));
  // A refetch the app started on its own is not a pull: nothing spins.
  expect(result.current.refreshing).toBe(false);

  await act(() => result.current.onRefresh());
  expect(result.current.refreshing).toBe(true);
  expect(refresh).toHaveBeenCalledTimes(1);

  await act(async () => finish());
  expect(result.current.refreshing).toBe(false);
});

it("stops spinning when the refresh fails", async () => {
  const { result } = await renderHook(() =>
    usePullToRefresh(() => Promise.reject(new Error("offline"))),
  );

  await act(async () => result.current.onRefresh());

  expect(result.current.refreshing).toBe(false);
});
