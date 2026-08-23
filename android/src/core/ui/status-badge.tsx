import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { RADIUS, SPACING } from "@/core/ui/theme";

interface StatusBadgeProps {
  /** One or two words. A badge names a state; it does not explain it. */
  children: ReactNode;
}

/**
 * A filled capsule naming the state of the thing it sits on — "Mois actuel" on
 * the month being lived in.
 *
 * It exists so that a tinted *state* stops becoming a tinted *surface*. The
 * current month used to be a whole card filled with `primaryContainer`, which
 * is the most saturated colour in the palette (87% saturation against 35% for
 * the home hero, the screen that is supposed to be the loudest thing in the
 * app) and which left the card's own text on `onSurface` roles resolved for a
 * neutral background — grey ink on a green field, at 4.36:1 in dark mode.
 *
 * A badge spends that accent on a fraction of the pixels and hands the card
 * back to the roles that were computed for it. Prominence comes from elevation
 * instead, which is what `ios/…/BudgetListView+Subviews.swift` already does.
 *
 * Sentence case, not the capitals iOS sets: Material 3 dropped all-caps labels,
 * and `Eyebrow` owns the one uppercase treatment this app still has.
 */
export function StatusBadge({ children }: StatusBadgeProps) {
  const theme = useTheme();

  return (
    <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
      <Text variant="labelSmall" style={{ color: theme.colors.onPrimary }}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    // The capsule hugs its word rather than stretching to the row it sits in.
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
});
