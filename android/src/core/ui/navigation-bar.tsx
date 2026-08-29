import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { BottomNavigation, useTheme } from "react-native-paper";

import { ICON_SIZE } from "./theme";

type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** Filled inside the active pill, outlined at rest — one pair per destination. */
const ICONS: Record<string, { focused: IconName; unfocused: IconName }> = {
  home: { focused: "home-variant", unfocused: "home-variant-outline" },
  budgets: { focused: "calendar-month", unfocused: "calendar-month-outline" },
  goals: { focused: "target", unfocused: "target" },
  templates: { focused: "file-document", unfocused: "file-document-outline" },
};

/**
 * Paper's Material 3 navigation bar under expo-router's `Tabs`. The stock bar
 * is UIKit-shaped, and `tabBarVariant: "material"` is the navigation *rail*,
 * which throws when asked for at the bottom — so the bar is Paper's, and the
 * router only supplies the state it draws.
 *
 * Titles and accessibility labels stay on the `Tabs.Screen` options, where
 * the catalog test expects them; only the icons live here.
 */
export function NavigationBar({
  descriptors,
  insets,
  navigation,
  state,
}: TabBarProps) {
  const theme = useTheme();

  return (
    <BottomNavigation.Bar
      navigationState={state}
      safeAreaInsets={insets}
      shifting={false}
      keyboardHidesNavigationBar
      activeIndicatorStyle={{
        backgroundColor: theme.colors.secondaryContainer,
      }}
      onTabPress={({ route, preventDefault }) => {
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });
        if (event.defaultPrevented) {
          preventDefault();
          return;
        }
        navigation.navigate(route.name, route.params);
      }}
      renderIcon={({ route, focused, color }) => {
        const pair = ICONS[route.name] ?? ICONS.home;
        return (
          <MaterialCommunityIcons
            name={focused ? pair.focused : pair.unfocused}
            size={ICON_SIZE.lg}
            color={color}
          />
        );
      }}
      getLabelText={({ route }) =>
        descriptors[route.key]?.options.title ?? route.name
      }
      getAccessibilityLabel={({ route }) =>
        descriptors[route.key]?.options.tabBarAccessibilityLabel
      }
      getTestID={({ route }) => `tab-${route.name}`}
    />
  );
}
