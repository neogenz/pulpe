import { Stack } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { useMemo } from "react";
import { Text } from "react-native";

import { AmountMaskBoundary } from "./amount-mask-boundary";
import { formatCurrency } from "./amount-format";
import {
  toggleAmountVisibility,
  useAmountMasking,
  useAmountVisibility,
} from "./amount-visibility";

/**
 * A screen written the way the React Compiler leaves one: the formatted string
 * is memoized on the value and the currency, so a re-render on the toggle gets
 * the cached string back. The boundary has to be what repaints it — the same
 * screen without it keeps printing the figure.
 */
function MemoizedAmountScreen() {
  useAmountMasking();
  const label = useMemo(() => formatCurrency(1234, "CHF"), []);
  return <Text testID="amount">{label}</Text>;
}

function layoutWith(isBounded: boolean) {
  return function Layout() {
    return (
      <Stack
        screenOptions={{ headerShown: false }}
        screenLayout={({ children }) =>
          isBounded ? (
            <AmountMaskBoundary>{children}</AmountMaskBoundary>
          ) : (
            children
          )
        }
      />
    );
  };
}

afterEach(() => {
  useAmountVisibility.setState({ areAmountsHidden: false });
});

it("repaints a memoized amount once amounts are hidden", async () => {
  await renderRouter(
    { _layout: layoutWith(true), index: MemoizedAmountScreen },
    { initialUrl: "/" },
  );
  expect(screen.getByTestId("amount")).toHaveTextContent("1’234.00 CHF");

  await act(() => toggleAmountVisibility());

  expect(screen.getByTestId("amount")).toHaveTextContent("•••");
});

it("keeps the stale string without the boundary, which is the bug it fixes", async () => {
  await renderRouter(
    { _layout: layoutWith(false), index: MemoizedAmountScreen },
    { initialUrl: "/" },
  );

  await act(() => toggleAmountVisibility());

  expect(screen.getByTestId("amount")).toHaveTextContent("1’234.00 CHF");
});
