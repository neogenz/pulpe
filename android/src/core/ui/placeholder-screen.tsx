import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text, useTheme } from "react-native-paper";

import { ActionButton } from "./action-button";
import { useV2Colors } from "./scheme-colors";
import { ICON_SIZE, RADIUS, SPACING } from "./theme";

const DISC_SIZE = 72;

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
  /**
   * `accent` guides (an empty state), `neutral` reports (a failure, a pause).
   * The disc carries it — `StatusScreen` on iOS.
   */
  tone?: "accent" | "neutral";
  /** The other way out, when retrying may never get past the state. */
  secondaryAction?: { label: string; onPress: () => void };
}

export function PlaceholderScreen({
  icon,
  title,
  hint,
  action,
  secondaryAction,
  tone = "accent",
}: PlaceholderScreenProps) {
  const theme = useTheme();
  const v2 = useV2Colors();
  const isAccent = tone === "accent";

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[
          styles.disc,
          { backgroundColor: isAccent ? v2.accentWash : v2.sunk },
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={ICON_SIZE.xl}
          color={isAccent ? v2.accentInk : theme.colors.onSurfaceVariant}
        />
      </View>
      <Text
        variant="titleLarge"
        style={[styles.centered, { color: theme.colors.onBackground }]}
      >
        {title}
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.centered, { color: theme.colors.onSurfaceVariant }]}
      >
        {hint}
      </Text>
      {action !== undefined && (
        <ActionButton
          loading={action.loading}
          disabled={action.loading}
          onPress={action.onPress}
          style={styles.action}
        >
          {action.label}
        </ActionButton>
      )}
      {secondaryAction !== undefined && (
        <Button onPress={secondaryAction.onPress}>
          {secondaryAction.label}
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
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  disc: {
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: { textAlign: "center" },
  action: { marginTop: SPACING.sm },
});
