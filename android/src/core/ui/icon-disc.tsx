import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import { ICON_SIZE, RADIUS, TINT_ALPHA } from "./theme";

const DIAMETER = 36;

interface IconDiscProps {
  name: ComponentProps<typeof MaterialCommunityIcons>["name"];
  /** Colours both the glyph and, faintly, the disc it sits on. */
  tint: string;
}

/**
 * An icon on a disc of its own colour, which is how a row says what kind of
 * operation it is before the eye reaches the words. Three cards had written it
 * out separately, each with its own copy of the diameter and of the two hex
 * digits that make the disc faint — the same numbers, kept in step by nothing.
 */
export function IconDisc({ name, tint }: IconDiscProps) {
  return (
    <View
      style={[styles.disc, { backgroundColor: `${tint}${TINT_ALPHA.icon}` }]}
    >
      <MaterialCommunityIcons name={name} size={ICON_SIZE.md} color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    width: DIAMETER,
    height: DIAMETER,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
