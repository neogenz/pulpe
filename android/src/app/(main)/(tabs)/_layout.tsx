import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";
import { useTheme } from "react-native-paper";

const TAB_ICON_SIZE = 24;

/**
 * The four top-level destinations, and nothing else. Every other screen is a
 * push on the stack one level up: a screen that cannot be reached from the bar
 * has no business being a tab, and registering it here — even hidden behind
 * `href: null` — is what left the bar with no active item on a detail screen.
 */
export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // No `tabBarVariant: "material"` here, however much the bar looks like
        // UIKit: that variant is the Material navigation *rail*, and asking for
        // it at the bottom throws on render — "only supported when
        // 'tabBarPosition' is set to 'left' or 'right'"
        // (`BottomTabBar.js:122`). A Material 3 bottom bar with its active
        // pill would have to be a `tabBar` of our own.
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: { backgroundColor: theme.colors.surface },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons
              name="home-variant-outline"
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: "Budgets",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "Objectifs",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons
              name="target"
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          title: "Modèles",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons
              name="file-document-outline"
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
