import { Tabs, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useTheme } from "react-native-paper";

import { AmountMaskBoundary } from "@/core/ui/amount-mask-boundary";
import { NavigationBar } from "@/core/ui/navigation-bar";
import { useTranslation } from "@/core/i18n/locale-store";
import { useFeatureFlag } from "@/core/observability/feature-flags";
import {
  shouldLeaveNetWorthTab,
  withoutNetWorthTab,
} from "@/features/net-worth/net-worth-tab";
import { FEATURE_FLAGS } from "pulpe-shared";

/**
 * The top-level destinations (a fifth, « Patrimoine », only behind the
 * `net_worth` flag), and nothing else. Every other screen is a
 * push on the stack one level up: a screen that cannot be reached from the bar
 * has no business being a tab, and registering it here — even hidden behind
 * `href: null` — is what left the bar with no active item on a detail screen.
 *
 * Icons are the bar's own (`NavigationBar`); the options keep what the bar
 * reads back — the title and the accessibility label.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const isNetWorthEnabled = useFeatureFlag(FEATURE_FLAGS.NET_WORTH);

  useEffect(() => {
    if (shouldLeaveNetWorthTab(isNetWorthEnabled, segments)) {
      router.replace("/home");
    }
  }, [isNetWorthEnabled, segments, router]);

  return (
    <Tabs
      tabBar={(props) => (
        <NavigationBar
          {...props}
          state={
            isNetWorthEnabled ? props.state : withoutNetWorthTab(props.state)
          }
        />
      )}
      screenLayout={({ children }) => (
        <AmountMaskBoundary>{children}</AmountMaskBoundary>
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("main.tabs.home.short"),
          tabBarAccessibilityLabel: t("main.tabs.home.accessibility"),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: t("main.tabs.budgets.short"),
          tabBarAccessibilityLabel: t("main.tabs.budgets.accessibility"),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: t("main.tabs.goals.short"),
          tabBarAccessibilityLabel: t("main.tabs.goals.accessibility"),
        }}
      />
      <Tabs.Screen
        name="net-worth"
        options={{
          title: t("main.tabs.netWorth.short"),
          tabBarAccessibilityLabel: t("main.tabs.netWorth.accessibility"),
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          title: t("main.tabs.templates.short"),
          tabBarAccessibilityLabel: t("main.tabs.templates.accessibility"),
        }}
      />
    </Tabs>
  );
}
