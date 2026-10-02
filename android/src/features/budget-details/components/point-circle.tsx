import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ComponentProps, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import { hapticSelection } from "@/core/ui/haptics";
import { useTranslation } from "@/core/i18n/locale-store";
import { useRipple } from "@/core/ui/ripple";
import {
  EMPHASIS,
  ICON_SIZE,
  RADIUS,
  ROW,
  TINT_ALPHA,
  TOUCH_TARGET,
} from "@/core/ui/theme";

const RING_WIDTH = 1.5;

/**
 * Two taps closer than this are one finger bouncing, not two decisions: the
 * second is dropped rather than undoing the first.
 */
const DOUBLE_TAP_MS = 300;

interface PointCircleProps {
  isChecked: boolean;
  /** The kind's own ink, so the disc says what it is as well as whether it is done. */
  color: string;
  /** The kind's glyph, worn while there is still something to point. */
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  isSyncing: boolean;
  label: string;
  onToggle: () => void;
}

/**
 * The whole gesture of the app in one control, and the row's leading disc at
 * the same time — `PointCircle.swift`. To point, it is the row's own disc ringed
 * in dashes of its colour: unfinished, waiting. Pointed, the disc fills with the
 * colour and carries a check.
 *
 * Its own pressable rather than part of the row, so pointing never opens the
 * detail by accident and the screen reader announces two separate actions. The
 * disc is 36, the target Material's 48.
 */
export function PointCircle({
  isChecked,
  color,
  icon,
  isSyncing,
  label,
  onToggle,
}: PointCircleProps) {
  const theme = useTheme();
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
          styles.disc,
          isChecked
            ? { backgroundColor: color, borderColor: color }
            : {
                backgroundColor: `${color}${TINT_ALPHA.icon}`,
                borderColor: color,
                borderStyle: "dashed",
              },
        ]}
      >
        <MaterialCommunityIcons
          name={isChecked ? "check" : icon}
          size={ICON_SIZE.md}
          color={isChecked ? theme.colors.onPrimary : color}
        />
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
  disc: {
    width: ROW.disc,
    height: ROW.disc,
    borderRadius: RADIUS.full,
    borderWidth: RING_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
});
