import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { ICON_SIZE, RADIUS, SPACING, TINT_ALPHA } from "@/core/ui/theme";

interface StateChipProps {
  /** One colour carries both the wash and the ink — the meaning of the state. */
  tint: string;
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
  /** One or two words. A chip names a state; it does not explain it. */
  children: ReactNode;
}

/**
 * A state or a piece of information, on a wash of its own colour —
 * `PulpeChip.semantic` on iOS. Not pressable: a chip that does something is a
 * `FilterChip`, and the two families must not look alike.
 */
export function StateChip({ tint, icon, children }: StateChipProps) {
  return (
    <View
      style={[styles.chip, { backgroundColor: `${tint}${TINT_ALPHA.surface}` }]}
    >
      {icon !== undefined && (
        <MaterialCommunityIcons name={icon} size={ICON_SIZE.sm} color={tint} />
      )}
      <Text variant="labelMedium" style={[styles.label, { color: tint }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm + SPACING.xs,
    paddingVertical: SPACING.xs + SPACING.xxs,
    borderRadius: RADIUS.full,
  },
  label: { fontWeight: "700" },
});
