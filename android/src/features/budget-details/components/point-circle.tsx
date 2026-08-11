import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import { RADIUS } from "@/core/ui/theme";

/** 24pt ring inside a 44pt target — the Android and Apple floor alike. */
const RING_SIZE = 24;
const TAP_TARGET = 44;
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

  function handlePress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isSyncing}
      hitSlop={0}
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
    width: TAP_TARGET,
    height: TAP_TARGET,
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
