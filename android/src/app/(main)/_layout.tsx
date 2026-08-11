import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";
import { useTheme } from "react-native-paper";

const TAB_ICON_SIZE = 24;

export default function MainTabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
      {/* A full-screen handoff, not a destination: `href: null` keeps it out of
          the tab bar, and hiding the bar keeps its one CTA the only way on. */}
      <Tabs.Screen
        name="post-onboarding"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      {/* Reached from the dashboard, not from the bar: it is a one-off form,
          and a tab for it would sit there empty most of the time. */}
      <Tabs.Screen name="budget/create" options={{ href: null }} />
      <Tabs.Screen name="budget/[id]" options={{ href: null }} />
      <Tabs.Screen name="budget/[id]/line/[lineId]" options={{ href: null }} />
      <Tabs.Screen name="goal/[id]" options={{ href: null }} />
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
