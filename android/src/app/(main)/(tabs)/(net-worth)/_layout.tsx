import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";

import { AmountMaskBoundary } from "@/core/ui/amount-mask-boundary";

/**
 * « Patrimoine » is its own stack, as the other tabs: a detail screen opens
 * inside the tab, under the navigation bar. Screens remount when amounts are
 * hidden or shown, never the stack: that would send the tab back to its root.
 */
export default function NetWorthStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
      screenLayout={({ children }) => (
        <AmountMaskBoundary>{children}</AmountMaskBoundary>
      )}
    />
  );
}
