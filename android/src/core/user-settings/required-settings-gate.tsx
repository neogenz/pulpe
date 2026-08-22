import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "@/core/i18n/locale-store";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";

import { useUserSettings } from "./user-settings-queries";

export function RequiredSettingsGate({ children }: { children: ReactNode }) {
  const settings = useUserSettings();
  const theme = useTheme();
  const { t } = useTranslation();

  if (settings.data !== undefined) return children;

  if (settings.isError) {
    return (
      <PlaceholderScreen
        icon="cloud-alert-outline"
        title={t("system.requiredSettings.title")}
        hint={t("system.requiredSettings.hint")}
        action={{
          label: t("common.retry"),
          onPress: () => void settings.refetch(),
        }}
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.loading, { backgroundColor: theme.colors.background }]}
    >
      <ActivityIndicator
        accessibilityLabel={t("system.requiredSettings.loading")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
