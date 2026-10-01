import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useRipple } from "@/core/ui/ripple";

import {
  BRAND_TYPE,
  ICON_SIZE,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";

interface SectionHeaderProps {
  title: string;
  /** Set after the title, quieter — `Revenus · 3`. */
  count?: number;
  /** One amount under the title that sums the section up. */
  subtitle?: string;
  /** Where the section leads, named — `Tout voir` — never a bare chevron. */
  link?: { label: string; onPress: () => void; accessibilityLabel?: string };
}

/**
 * The Home Ledger Rule: a section names itself on the canvas, outside the card
 * that carries its rows, so the card's edge marks where its content starts.
 * Mirrors `SectionHeader.swift`.
 */
export function SectionHeader({
  title,
  count,
  subtitle,
  link,
}: SectionHeaderProps) {
  const theme = useTheme();
  const ripple = useRipple();

  return (
    <View style={styles.header}>
      <View style={styles.titleBlock} accessibilityRole="header">
        <Text
          style={[
            BRAND_TYPE.sectionTitle,
            { color: theme.colors.onBackground },
          ]}
        >
          {title}
          {count !== undefined && (
            <Text
              variant="titleSmall"
              style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
            >
              {`  ·  ${count}`}
            </Text>
          )}
        </Text>
        {subtitle !== undefined && (
          <Text
            variant="labelLarge"
            style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {link !== undefined && (
        <Pressable
          onPress={link.onPress}
          accessibilityRole="button"
          accessibilityLabel={link.accessibilityLabel ?? link.label}
          hitSlop={LINK_SLOP}
          android_ripple={ripple}
          style={styles.link}
        >
          <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
            {link.label}
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={ICON_SIZE.sm}
            color={theme.colors.primary}
          />
        </Pressable>
      )}
    </View>
  );
}

/** Lifts the link to a 48dp target without moving it off the title's line. */
const LINK_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  titleBlock: { flexShrink: 1, gap: SPACING.xxs },
  link: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: SPACING.xxs,
  },
});
