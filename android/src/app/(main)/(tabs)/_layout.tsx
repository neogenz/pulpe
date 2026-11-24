import { Tabs, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { useTheme } from "react-native-paper";

import { currentTab } from "@/core/navigation/tab-route";
import { NavigationBar } from "@/core/ui/navigation-bar";
import { useTranslation } from "@/core/i18n/locale-store";
import { useFeatureFlag } from "@/core/observability/feature-flags";
import { captureTabSwitched } from "@/core/observability/product-events";
import {
  shouldLeaveNetWorthTab,
  withoutNetWorthTab,
} from "@/features/net-worth/net-worth-tab";
import { FEATURE_FLAGS } from "pulpe-shared";

/**
 * The top-level destinations (a fifth, « Patrimoine », only behind the
 * `net_worth` flag), and nothing else. Each is a group holding the tab's own
 * stack, so a detail screen opens under the bar with its tab still active. A
 * screen that cannot be reached from the bar has no business being a tab, and
 * registering it here — even hidden behind `href: null` — is what left the
 * bar with no active item.
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

  // The tab name, never a label, and never a detail screen pushed inside it.
  const tab = currentTab(segments);

  useEffect(() => {
    if (shouldLeaveNetWorthTab(isNetWorthEnabled, tab)) {
      router.replace("/home");
    }
  }, [isNetWorthEnabled, tab, router]);

  // The tab the app opens on is not a switch, and neither is a screen pushed
  // over the bar: the tab under it has not changed.
  const previousTab = useRef(tab);
  useEffect(() => {
    if (tab === undefined || previousTab.current === tab) return;
    previousTab.current = tab;
    captureTabSwitched(tab);
  }, [tab]);

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
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: t("main.tabs.home.short"),
          tabBarAccessibilityLabel: t("main.tabs.home.accessibility"),
        }}
      />
      <Tabs.Screen
        name="(budgets)"
        options={{
          title: t("main.tabs.budgets.short"),
          tabBarAccessibilityLabel: t("main.tabs.budgets.accessibility"),
        }}
      />
      <Tabs.Screen
        name="(goals)"
        options={{
          title: t("main.tabs.goals.short"),
          tabBarAccessibilityLabel: t("main.tabs.goals.accessibility"),
        }}
      />
      <Tabs.Screen
        name="(net-worth)"
        options={{
          title: t("main.tabs.netWorth.short"),
          tabBarAccessibilityLabel: t("main.tabs.netWorth.accessibility"),
        }}
      />
      <Tabs.Screen
        name="(templates)"
        options={{
          title: t("main.tabs.templates.short"),
          tabBarAccessibilityLabel: t("main.tabs.templates.accessibility"),
        }}
      />
    </Tabs>
  );
}
