import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useTheme } from "react-native-paper";

import { useKeyboardHeight } from "@/core/ui/keyboard-inset";
import { SPACING } from "@/core/ui/theme";

interface PinScreenProps {
  testID?: string;
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
  testID,
  title,
  subtitle,
  children,
  footer,
}: PinScreenProps) {
  const theme = useTheme();
  const keyboardHeight = useKeyboardHeight();

  return (
    <SafeAreaView
      testID={testID}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      {/* The pad needs no keyboard, but the recovery key does, and the window
          does not shrink for it (`keyboard-inset.ts`): its field and
          "Continuer" sat under the keys. Padding a scroll by the inset
          recentres the step in what the keys leave, and lets a step taller
          than that scroll rather than lose its top. With the keyboard down
          the padding is zero and the layout is the centred column it was. */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: keyboardHeight },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.centered}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              variant="bodyMedium"
              style={[
                styles.centered,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {children}

        <View style={styles.footer}>{footer}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xl,
  },
  header: { gap: SPACING.sm },
  centered: { textAlign: "center" },
  footer: { alignItems: "center", minHeight: SPACING.xxl },
});
