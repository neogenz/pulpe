import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";

import { SPACING } from "./theme";

export function InlineQueryError({
  onRetry,
  message,
}: {
  onRetry: () => void;
  message?: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const resolvedMessage = message ?? t("system.queryError");

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={styles.container}
    >
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {resolvedMessage}
      </Text>
      <Button mode="outlined" compact onPress={onRetry}>
        {t("common.retry")}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "flex-start", gap: SPACING.sm },
});
