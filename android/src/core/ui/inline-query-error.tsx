import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { SPACING } from "./theme";

export function InlineQueryError({
  onRetry,
  message = "Impossible de charger cette section.",
}: {
  onRetry: () => void;
  message?: string;
}) {
  const theme = useTheme();

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
        {message}
      </Text>
      <Button mode="outlined" compact onPress={onRetry}>
        Réessayer
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "flex-start", gap: SPACING.sm },
});
