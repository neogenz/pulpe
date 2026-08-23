import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { Amount } from "@/core/ui/amount";
import { ICON_SIZE, RADIUS, SPACING, TINT_ALPHA } from "@/core/ui/theme";

interface PillProps {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  /** Already formatted — the pill sets the voice, not the number. */
  amount: string;
  label: string;
  /** The accent the whole pill is built from: its ink and, at 12%, its surface. */
  tint: string;
}

/**
 * A statistic on a tinted capsule. `DESIGN.md:153` says a chip-shaped thing is
 * a component and not a `Capsule().fill()` written again — this was the third
 * chip grammar in the app, drawn by hand inside a hero.
 */
export function Pill({ icon, amount, label, tint }: PillProps) {
  return (
    <View
      style={[styles.pill, { backgroundColor: `${tint}${TINT_ALPHA.surface}` }]}
    >
      <MaterialCommunityIcons name={icon} size={ICON_SIZE.sm} color={tint} />
      <Amount size="meta" style={{ color: tint }}>
        {amount}
      </Amount>
      <Text variant="labelLarge" style={{ color: tint }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
});
