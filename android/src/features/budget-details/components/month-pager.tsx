import type { BudgetSparse } from "pulpe-shared";
import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Chip } from "react-native-paper";

import { formatMonthName } from "@/core/ui/date-format";
import { SCREEN_PADDING, SPACING } from "@/core/ui/theme";

/** Roughly one chip; enough to leave the selected one near the middle. */
const CHIP_WIDTH = 96;

interface MonthPagerProps {
  /** Every budget the account has, oldest first. */
  months: BudgetSparse[];
  currentBudgetId: string;
  onSelect: (budgetId: string) => void;
}

/**
 * Every month with a budget, left to right like a calendar. Deliberately always
 * visible rather than revealed on scroll as on iOS: the reveal is a
 * scroll-driven animation, and a rail that is simply there navigates just as
 * well without one.
 */
export function MonthPager({
  months,
  currentBudgetId,
  onSelect,
}: MonthPagerProps) {
  const rail = useRef<ScrollView>(null);
  const index = months.findIndex((month) => month.id === currentBudgetId);

  // The selected chip is rarely the first one, and a rail that opens on the
  // account's oldest month hides where the user actually is.
  useEffect(() => {
    if (index < 0) return;
    rail.current?.scrollTo({ x: index * CHIP_WIDTH, animated: false });
  }, [index]);

  const anchorYear = months[index]?.year;

  return (
    <View accessibilityLabel="Sélecteur de mois">
      <ScrollView
        ref={rail}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {months.map((month) => (
          <Chip
            key={month.id}
            selected={month.id === currentBudgetId}
            showSelectedCheck={false}
            onPress={() => onSelect(month.id)}
            compact
            textStyle={styles.label}
          >
            {chipLabel(month, anchorYear)}
          </Chip>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * "Mai" among its own year's months, "Mai 2025" once the year differs from the
 * one being looked at — the suffix appears exactly where it disambiguates.
 */
function chipLabel(
  month: BudgetSparse,
  anchorYear: number | undefined,
): string {
  const name = formatMonthName(month.month ?? 1, month.year ?? 0);
  return month.year === anchorYear ? name : `${name} ${month.year}`;
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
    // The rail itself spans the display; the gutter lives here so the first and
    // last month scroll past it instead of being cut in half by it.
    paddingHorizontal: SCREEN_PADDING,
  },
  label: { textTransform: "capitalize" },
});
