import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";

import { AmountMaskBoundary } from "@/core/ui/amount-mask-boundary";

/**
 * Each tab is its own stack, as on iOS: a month, a goal or a setting opens
 * inside the tab it was reached from, under the navigation bar, and the tab
 * keeps it when the user switches away and comes back.
 *
 * This one layout serves four tabs. The budget, goal and « À pointer » screens
 * it holds are shared, so a month opened from Accueil stays in Accueil and
 * « À pointer » opened from a month goes back to it; the other screens live in
 * the one tab's folder that reaches them (`(home)/settings`,
 * `(templates)/template`). Each tab's root comes first, whatever the entry.
 */
export const unstable_settings = {
  home: { anchor: "home" },
  budgets: { anchor: "budgets" },
  goals: { anchor: "goals" },
  templates: { anchor: "templates" },
};

export default function TabStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
      // Screens remount when amounts are hidden or shown, never the stack: that
      // would send the tab back to its root. The settings print no amount, and
      // remounting them would throw away the very screen the toggle is on.
      screenLayout={({ route, children }) =>
        route.name.startsWith("settings") ? (
          children
        ) : (
          <AmountMaskBoundary>{children}</AmountMaskBoundary>
        )
      }
    />
  );
}
