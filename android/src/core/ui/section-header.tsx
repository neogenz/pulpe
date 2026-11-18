import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { SPACING, TABULAR_DIGITS, TOUCH_TARGET } from "@/core/ui/theme";

interface SectionHeaderProps {
  title: string;
  /** Set after the title, quieter — `Revenus · 3`. */
  count?: number;
  /** One amount under the title that sums the section up. */
  subtitle?: string;
  /** Where the section leads, named — `Tout voir`. */
  link?: {
    label: string;
    onPress: () => void;
    accessibilityLabel?: string;
    /** Trails the label — Material's `chevron-down` for a section that unfolds in place. */
    icon?: string;
  };
}

/**
 * The Home Ledger Rule: a section names itself on the canvas, outside the card
 * that carries its rows, so the card's edge marks where its content starts.
 *
 * The rule is Pulpe's; the pieces are Android's. The title is chrome, so it is
 * MD3's `titleLarge` on the system face, and a Material text button keeps the
 * link tappable when its label is short.
 */
export function SectionHeader({
  title,
  count,
  subtitle,
  link,
}: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text
          variant="titleLarge"
          accessibilityRole="header"
          style={[styles.title, { color: theme.colors.onBackground }]}
        >
          {title}
          {count !== undefined && (
            <Text
              variant="titleSmall"
              style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
            >
              {/* Non-breaking: a wrapped title carries its count along instead of
                  stranding `· 5` at the start of a line. */}
              {`\u00A0\u00A0·\u00A0${count}`}
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
        <Button
          mode="text"
          compact
          onPress={link.onPress}
          accessibilityLabel={link.accessibilityLabel ?? link.label}
          icon={link.icon}
          contentStyle={styles.linkContent}
          style={styles.link}
        >
          {link.label}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  titleBlock: { flexShrink: 1, gap: SPACING.xxs },
  title: { fontWeight: "500" },
  // The button's own padding would push its label off the content's right edge.
  link: { minWidth: TOUCH_TARGET, marginRight: -SPACING.sm },
  linkContent: { flexDirection: "row-reverse", minHeight: TOUCH_TARGET },
});
