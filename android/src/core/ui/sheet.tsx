import type { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Divider, Modal, Portal, Text, useTheme } from "react-native-paper";

import { RADIUS, SPACING } from "./theme";

/** How much of the display a sheet may take before its body starts scrolling. */
const MAX_HEIGHT_RATIO = 0.88;

interface SheetProps {
  isVisible: boolean;
  onDismiss: () => void;
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
 * The cap is read from `useWindowDimensions`, which on Android shrinks when the
 * soft keyboard opens — so a sheet gets out of the keyboard's way by measuring
 * the window it actually has, with no keyboard listener of its own.
 */
export function Sheet({
  isVisible,
  onDismiss,
  title,
  subtitle,
  footer,
  children,
}: SheetProps) {
  const theme = useTheme();
  const { height } = useWindowDimensions();

  return (
    <Portal>
      <Modal
        visible={isVisible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.sheet,
          {
            backgroundColor: theme.colors.surface,
            maxHeight: height * MAX_HEIGHT_RATIO,
          },
        ]}
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
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
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
