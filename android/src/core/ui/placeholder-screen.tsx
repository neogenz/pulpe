import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useTheme } from "react-native-paper";

import { SPACING } from "./theme";

interface PlaceholderScreenProps {
  title: string;
  /** Empty states guide rather than apologise — the Tutoiement Rule. */
  hint: string;
}

export function PlaceholderScreen({ title, hint }: PlaceholderScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <Text variant="headlineSmall">{title}</Text>
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {hint}
      </Text>
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
});
