import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import { RADIUS } from "./theme";

interface StepDotsProps {
  count: number;
  /** Zero-based. */
  current: number;
  /** « Étape N sur M », read as one element instead of the dots. */
  label: string;
}

/** The progress of a short guide: one dot per step, the current one stretched. */
export function StepDots({ count, current, label }: StepDotsProps) {
  const theme = useTheme();
  return (
    <View style={styles.dots} accessible accessibilityLabel={label}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === current && styles.dotCurrent,
            {
              backgroundColor:
                index === current
                  ? theme.colors.primary
                  : theme.colors.outlineVariant,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: RADIUS.full },
  dotCurrent: { width: 22 },
});
