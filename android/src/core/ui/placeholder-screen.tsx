import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text, useTheme } from "react-native-paper";

import { SPACING } from "./theme";

interface PlaceholderScreenProps {
  title: string;
  /** Empty states guide rather than apologise — the Tutoiement Rule. */
  hint: string;
  /** A way out of the state, when there is one to offer. */
  action?: { label: string; onPress: () => void };
}

export function PlaceholderScreen({
  title,
  hint,
  action,
}: PlaceholderScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <Text variant="headlineSmall" style={styles.centered}>
        {title}
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.centered, { color: theme.colors.onSurfaceVariant }]}
      >
        {hint}
      </Text>
      {action !== undefined && (
        <Button mode="contained" onPress={action.onPress}>
          {action.label}
        </Button>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  centered: { textAlign: "center" },
});
