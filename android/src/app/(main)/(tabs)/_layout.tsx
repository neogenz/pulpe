import { Tabs } from "expo-router";
import { useTheme } from "react-native-paper";

import { NavigationBar } from "@/core/ui/navigation-bar";
import { useTranslation } from "@/core/i18n/locale-store";

/**
 * The four top-level destinations, and nothing else. Every other screen is a
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

  return (
    <Tabs
      tabBar={(props) => <NavigationBar {...props} />}
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
        name="templates"
        options={{
          title: t("main.tabs.templates.short"),
          tabBarAccessibilityLabel: t("main.tabs.templates.accessibility"),
        }}
      />
    </Tabs>
  );
}
