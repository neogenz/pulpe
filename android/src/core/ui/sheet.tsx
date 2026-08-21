import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "@/core/i18n/locale-store";

import { sheetBox, useKeyboardHeight } from "./keyboard-inset";
import { useRipple } from "./ripple";
import { RADIUS, SPACING } from "./theme";

interface SheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  isBusy?: boolean;
  title: string;
  /** Sits under the title, for the one line of context a form sometimes needs. */
  subtitle?: string;
  /**
   * Pinned below the body rather than scrolled with it. A form long enough to
   * scroll — a dozen tags is enough — otherwise pushes its own submit button
   * off the bottom of the screen, which is exactly where it must never be.
   */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * The one shape every sheet in the app takes: a capped card, a scrolling body,
 * and actions that stay put.
 *
 * Getting out of the keyboard's way is this component's job alone, which is why
 * no call site owns a `KeyboardAvoidingView`: eleven of the seventeen sheets
 * hold both a text field and a pinned footer, and a submit button under the
 * keys is the one place it must never be. `sheetBox` says how, and why the
 * window's own height cannot be asked.
 */
export function Sheet({
  isVisible,
  onDismiss,
  isBusy = false,
  title,
  subtitle,
  footer,
  children,
}: SheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const ripple = useRipple();
  const { bottom } = useSafeAreaInsets();
  const box = sheetBox({
    windowHeight: height,
    keyboardHeight,
    safeBottom: bottom,
  });

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={isBusy ? () => undefined : onDismiss}
    >
      <View
        style={[styles.backdrop, { backgroundColor: theme.colors.backdrop }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={isBusy ? undefined : onDismiss}
          android_ripple={ripple}
          accessible={!isBusy}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: theme.colors.surface }, box]}
        >
          <View style={styles.header}>
            <Text variant="titleMedium">{title}</Text>
            {subtitle !== undefined && (
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {subtitle}
              </Text>
            )}
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {footer !== undefined && (
            <>
              <Divider />
              <View style={styles.footer}>{footer}</View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center" },
  sheet: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.xxs,
  },
  body: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  footer: { padding: SPACING.lg, gap: SPACING.sm },
});
