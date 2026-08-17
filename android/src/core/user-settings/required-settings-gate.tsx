import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { PlaceholderScreen } from "@/core/ui/placeholder-screen";

import { useUserSettings } from "./user-settings-queries";

export function RequiredSettingsGate({ children }: { children: ReactNode }) {
  const settings = useUserSettings();
  const theme = useTheme();

  if (settings.data !== undefined) return children;

  if (settings.isError) {
    return (
      <PlaceholderScreen
        icon="cloud-alert-outline"
        title="Tes préférences sont indisponibles"
        hint="Réessaie pour charger ta devise et ton jour de paie."
        action={{
          label: "Réessayer",
          onPress: () => void settings.refetch(),
        }}
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.loading, { backgroundColor: theme.colors.background }]}
    >
      <ActivityIndicator accessibilityLabel="Chargement de tes préférences" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
