import { StyleSheet, View } from "react-native";

import { useFinancialColors, useV2Colors } from "@/core/ui/scheme-colors";
import { RADIUS } from "@/core/ui/theme";

const TRACK_HEIGHT = 8;

interface GoalProgressTrackProps {
  /** 0…1, clamped. */
  fraction: number;
  /** A paused goal draws its bar in grey. */
  isMuted?: boolean;
}

/** The goal bar of the V2 board: a sunk track under a green fill. Decorative. */
export function GoalProgressTrack({
  fraction,
  isMuted = false,
}: GoalProgressTrackProps) {
  const v2 = useV2Colors();
  const financial = useFinancialColors();
  const clamped = Math.min(Math.max(fraction, 0), 1);

  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[styles.track, { backgroundColor: v2.sunk }]}
    >
      <View
        style={[
          styles.fill,
          {
            backgroundColor: isMuted ? v2.ink3 : financial.savings,
            width: `${clamped * 100}%`,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: RADIUS.full },
});
