import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import { useRipple } from "@/core/ui/ripple";
import { RADIUS, TOUCH_TARGET } from "@/core/ui/theme";

/** A 24pt ring inside Material's 48dp target, which is not Apple's 44. */
const RING_SIZE = 24;
const RING_WIDTH = 2;
const CHECK_SIZE = 14;

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
  // Borderless, so the acknowledgement is a disc around the ring rather than a
  // square lighting up inside a rounded row.
  const ripple = useRipple({ radius: TOUCH_TARGET / 2 });

  function handlePress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      accessibilityLabel={`${isChecked ? "Pointé" : "À pointer"} · ${label}`}
    >
      <View
        style={[
          styles.ring,
          {
            borderColor: isChecked ? color : theme.colors.outlineVariant,
            backgroundColor: isChecked ? color : "transparent",
          },
        ]}
      >
        {isChecked && (
          <MaterialCommunityIcons
            name="check"
            size={CHECK_SIZE}
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
  syncing: { opacity: 0.4 },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RADIUS.full,
    borderWidth: RING_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
});
