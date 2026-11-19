import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";

import { AmountMaskBoundary } from "@/core/ui/amount-mask-boundary";
import { RouteErrorBoundary } from "@/core/ui/route-error-boundary";
import { RequiredSettingsGate } from "@/core/user-settings/required-settings-gate";

/**
 * The tab bar and the few screens that cover it: the full-screen forms that
 * create or plan months (sheets on iOS) and the post-onboarding step. Every
 * other screen is pushed inside its tab's own stack, under the bar
 * (`(tabs)/(home,budgets,goals,templates)/_layout.tsx`).
 *
 * The screens are not enumerated here. expo-router discovers them from the
 * directory, and listing them by hand only re-stated the file tree — wrongly,
 * as it turned out: a nested path with no layout of its own is a route `Tabs`
 * tolerated and `Stack` does not. A screen that needs an option sets it from
 * its own file.
 */
export default function MainLayout() {
  const theme = useTheme();

  return (
    <RequiredSettingsGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
        // The tabs remount their own screens; remounting the tabs navigator
        // would throw away every tab's stack.
        screenLayout={({ route, children }) =>
          route.name === "(tabs)" ? (
            children
          ) : (
            <AmountMaskBoundary>{children}</AmountMaskBoundary>
          )
        }
      />
    </RequiredSettingsGate>
  );
}

/**
 * A screen that throws is replaced by a retry inside the signed-in area, below
 * the root's providers, instead of taking the whole app down with it.
 */
export const ErrorBoundary = RouteErrorBoundary;
