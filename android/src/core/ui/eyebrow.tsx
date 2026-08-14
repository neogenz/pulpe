import type { ReactNode } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { UPPERCASE_TRACKING } from "@/core/ui/theme";

interface EyebrowProps {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}

/**
 * The small line of capitals that says what the thing under it is — over a hero
 * amount, over a group of settings rows.
 *
 * Capitals throw away the word-shape the eye actually reads by, and the app had
 * been setting them at three sizes with tracking on one of them, so the same
 * device read as a label above a number and as a heading above a list. One
 * component, one tracking, and the difference stops being a decision.
 */
export function Eyebrow({ children, style }: EyebrowProps) {
  const theme = useTheme();

  return (
    <Text
      variant="labelLarge"
      style={[styles.eyebrow, { color: theme.colors.onSurfaceVariant }, style]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  eyebrow: { textTransform: "uppercase", letterSpacing: UPPERCASE_TRACKING },
});
