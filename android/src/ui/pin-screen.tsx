import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useTheme } from "react-native-paper";

import { SPACING } from "@/core/ui/theme";

interface PinScreenProps {
  title: string;
  subtitle?: string;
  /** The pad, or whatever the step asks for instead. */
  children: ReactNode;
  /** Escape hatches — forgotten PIN, sign out, go back. */
  footer?: ReactNode;
}

/**
 * The frame the three vault steps share. Keeping it in one place is what stops
 * setup, unlock and recovery from drifting into three slightly different
 * screens — the user meets them as one moment.
 */
export function PinScreen({
  title,
  subtitle,
  children,
  footer,
}: PinScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.centered}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="bodyMedium"
            style={[styles.centered, { color: theme.colors.onSurfaceVariant }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {children}

      <View style={styles.footer}>{footer}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xl,
  },
  header: { gap: SPACING.sm },
  centered: { textAlign: "center" },
  footer: { alignItems: "center", minHeight: SPACING.xxl },
});
