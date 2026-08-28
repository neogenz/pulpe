import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";

import { RequiredSettingsGate } from "@/core/user-settings/required-settings-gate";

/**
 * The tab bar and everything that covers it. A detail screen pushes over the
 * bar rather than living inside it: on Android a pushed destination owns the
 * whole screen and answers to the up arrow, which also gives these dense
 * screens back the height the bar was taking.
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
      />
    </RequiredSettingsGate>
  );
}
