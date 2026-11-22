import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import { hapticSelection } from "@/core/ui/haptics";
import { useTranslation } from "@/core/i18n/locale-store";
import { useRipple } from "@/core/ui/ripple";
import { useV2Colors } from "@/core/ui/scheme-colors";
import { EMPHASIS, ICON_SIZE, RADIUS, TOUCH_TARGET } from "@/core/ui/theme";

/** `DesignTokens.Checkbox` on iOS: the same circle on every row. */
const CIRCLE_SIZE = 28;
const RING_WIDTH = 2;

/**
 * Two taps closer than this are one finger bouncing, not two decisions: the
 * second is dropped rather than undoing the first.
 */
const DOUBLE_TAP_MS = 300;

interface PointCircleProps {
  isChecked: boolean;
  isSyncing: boolean;
  label: string;
  onToggle: () => void;
}

/**
 * The whole gesture of the app in one control — `PointCircle.swift`. To point,
 * an empty circle: a box still to tick, never tinted by the row's nature.
 * Pointed, a filled disc with a check.
 *
 * Its own pressable rather than part of the row, so pointing never opens the
 * detail by accident and the screen reader announces two separate actions. The
 * circle is 28, the target Material's 48.
 */
export function PointCircle({
  isChecked,
  isSyncing,
  label,
  onToggle,
}: PointCircleProps) {
  const theme = useTheme();
  const v2 = useV2Colors();
  const { t } = useTranslation();
  const ripple = useRipple({ radius: TOUCH_TARGET / 2 });
  const lastTapAt = useRef(0);

  // Never disabled while a pointing is in flight: the server flips whatever it
  // holds, so a second deliberate tap — taking back a pointing made by
  // mistake — always lands where it means to. It used to be swallowed for the
  // whole round trip and refetch, and the row stayed pointed.
  function handlePress() {
    const now = Date.now();
    if (now - lastTapAt.current < DOUBLE_TAP_MS) return;
    lastTapAt.current = now;
    hapticSelection();
    onToggle();
  }

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={ripple}
      style={[styles.target, isSyncing && styles.syncing]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked, busy: isSyncing }}
      accessibilityLabel={`${t(`budgets.detail.filters.${isChecked ? "checked" : "unchecked"}`)} · ${label}`}
    >
      <View
        style={[
          styles.circle,
          isChecked
            ? {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
              }
            : { borderColor: v2.pointRing },
        ]}
      >
        {isChecked && (
          <MaterialCommunityIcons
            name="check-bold"
            size={ICON_SIZE.sm}
            color={theme.colors.onPrimary}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  syncing: { opacity: EMPHASIS.pending },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: RADIUS.full,
    borderWidth: RING_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
});
