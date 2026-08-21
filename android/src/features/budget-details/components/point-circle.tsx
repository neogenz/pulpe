import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import { hapticSelection } from "@/core/ui/haptics";
import { useTranslation } from "@/core/i18n/locale-store";
import { useRipple } from "@/core/ui/ripple";
import { EMPHASIS, ICON_SIZE, RADIUS, TOUCH_TARGET } from "@/core/ui/theme";

/** A 24pt ring inside Material's 48dp target, which is not Apple's 44. */
const RING_SIZE = 24;
const RING_WIDTH = 2;

interface PointCircleProps {
  isChecked: boolean;
  /** The kind's own ink, so the filled ring says what it is as well as that it is done. */
  color: string;
  isSyncing: boolean;
  label: string;
  onToggle: () => void;
}

/**
 * The whole gesture of the app in one control. Its own pressable rather than
 * part of the row, so pointing never opens the detail by accident and the
 * screen reader announces two separate actions.
 */
export function PointCircle({
  isChecked,
  color,
  isSyncing,
  label,
  onToggle,
}: PointCircleProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  // Borderless, so the acknowledgement is a disc around the ring rather than a
  // square lighting up inside a rounded row.
  const ripple = useRipple({ radius: TOUCH_TARGET / 2 });

  function handlePress() {
    hapticSelection();
    onToggle();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isSyncing}
      android_ripple={ripple}
      style={[styles.target, isSyncing && styles.syncing]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked }}
      accessibilityLabel={`${t(`budgets.detail.filters.${isChecked ? "checked" : "unchecked"}`)} · ${label}`}
    >
      <View
        style={[
          styles.ring,
          {
            // `outline`, not `outlineVariant`: the divider role measured
            // 1.70:1 against the surface, and an empty ring *is* the state of
            // the control — WCAG 1.4.11 asks 3:1 of it. `outline` gives 4.49:1.
            borderColor: isChecked ? color : theme.colors.outline,
            backgroundColor: isChecked ? color : "transparent",
          },
        ]}
      >
        {isChecked && (
          <MaterialCommunityIcons
            name="check"
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
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RADIUS.full,
    borderWidth: RING_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
});
