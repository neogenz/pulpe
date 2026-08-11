import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import { RADIUS, SPACING } from "@/core/ui/theme";

const DOT_SIZE = 8;
const CURRENT_DOT_WIDTH = 24;

/**
 * Where the user is, without a number attached. The count is stable for a whole
 * run — a step the user will never see is left out from the start rather than
 * disappearing under them halfway through.
 */
export function ProgressDots({
  total,
  currentIndex,
}: {
  total: number;
  currentIndex: number;
}) {
  const theme = useTheme();

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={`Étape ${currentIndex + 1} sur ${total}`}
    >
      {Array.from({ length: total }, (_unused, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === currentIndex && styles.currentDot,
            {
              backgroundColor:
                index <= currentIndex
                  ? theme.colors.primary
                  : theme.colors.surfaceVariant,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: RADIUS.full,
  },
  currentDot: { width: CURRENT_DOT_WIDTH },
});
