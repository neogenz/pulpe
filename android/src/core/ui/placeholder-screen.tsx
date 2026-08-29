import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text, useTheme } from "react-native-paper";

import { SCREEN_PADDING, SPACING } from "./theme";

const PLACEHOLDER_ICON_SIZE = 56;

interface PlaceholderScreenProps {
  /**
   * What the screen is showing nothing about, or what went wrong. This screen
   * serves both, and without it the two were indistinguishable — the same title
   * over the same hint over the same button, so a network failure read exactly
   * like "you have not made a budget yet" and the user could not tell whether
   * to act or to retry.
   */
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  title: string;
  /** Empty states guide rather than apologise — the Tutoiement Rule. */
  hint: string;
  /** A way out of the state, when there is one to offer. */
  action?: { label: string; loading?: boolean; onPress: () => void };
}

export function PlaceholderScreen({
  icon,
  title,
  hint,
  action,
}: PlaceholderScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={PLACEHOLDER_ICON_SIZE}
        color={theme.colors.onSurfaceVariant}
      />
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
        <Button
          mode="contained"
          loading={action.loading}
          disabled={action.loading}
          onPress={action.onPress}
        >
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
    padding: SCREEN_PADDING,
    gap: SPACING.sm,
  },
  centered: { textAlign: "center" },
});
