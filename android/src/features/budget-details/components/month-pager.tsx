import type { BudgetSparse } from "pulpe-shared";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Text, useTheme } from "react-native-paper";

import { formatMonthName } from "@/core/ui/date-format";
import { useTranslation } from "@/core/i18n/locale-store";
import { useRipple } from "@/core/ui/ripple";
import { SPACING, TOUCH_TARGET } from "@/core/ui/theme";

/** M3's primary tab indicator, and the divider the row of them sits on. */
const INDICATOR_HEIGHT = 3;
const DIVIDER_HEIGHT = 1;

interface MonthPagerProps {
  /** Every budget the account has, oldest first. */
  months: BudgetSparse[];
  currentBudgetId: string;
  onSelect: (budgetId: string) => void;
}

/** Where a tab sits in the rail, so the selected one can be scrolled into view. */
interface TabLayout {
  x: number;
  width: number;
}

/**
 * Every month with a budget, left to right like a calendar.
 *
 * Tabs, not chips. Two blocks further down this same screen, a filled pill in
 * the accent colour means "this filter is on" — `DetailsFilterBar` uses the very
 * `FilterChip` this rail used to. So the two rows looked alike and meant
 * different things: one filtered the list in place, the other replaced the whole
 * screen with another month. A label under a moving indicator is what Android
 * gives a set of sibling pages, and it reads as navigation on sight.
 *
 * Deliberately always visible rather than revealed on scroll as on iOS: the
 * reveal is a scroll-driven animation, and a rail that is simply there navigates
 * just as well without one.
 */
export function MonthPager({
  months,
  currentBudgetId,
  onSelect,
}: MonthPagerProps) {
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const ripple = useRipple();
  const rail = useRef<ScrollView>(null);
  const layouts = useRef(new Map<string, TabLayout>());
  const [railWidth, setRailWidth] = useState(0);

  const index = months.findIndex((month) => month.id === currentBudgetId);
  const anchorYear = months[index]?.year;

  // The selected tab is rarely the first one, and a rail that opens on the
  // account's oldest month hides where the user actually is. Centred from the
  // tab's measured position rather than from an assumed width — "Septembre" is
  // half again as wide as "Mai", so any single constant is wrong for both.
  useEffect(() => {
    const layout = layouts.current.get(currentBudgetId);
    if (layout === undefined || railWidth === 0) return;
    rail.current?.scrollTo({
      x: Math.max(0, layout.x + layout.width / 2 - railWidth / 2),
      animated: false,
    });
  }, [currentBudgetId, railWidth]);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t("budgets.detail.monthSelector")}
      onLayout={(event: LayoutChangeEvent) =>
        setRailWidth(event.nativeEvent.layout.width)
      }
      style={[styles.rail, { borderBottomColor: theme.colors.outlineVariant }]}
    >
      {/* No padding on the content: each tab carries the screen gutter itself,
          so the first label lines up with the column below while its hit area
          still reaches the display edge. */}
      <ScrollView ref={rail} horizontal showsHorizontalScrollIndicator={false}>
        {months.map((month) => {
          const isSelected = month.id === currentBudgetId;
          return (
            <Pressable
              key={month.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              android_ripple={ripple}
              onPress={() => onSelect(month.id)}
              onLayout={(event: LayoutChangeEvent) => {
                const { x, width } = event.nativeEvent.layout;
                layouts.current.set(month.id, { x, width });
              }}
              style={styles.tab}
            >
              <Text
                variant="titleSmall"
                style={[
                  styles.label,
                  {
                    color: isSelected
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                {tabLabel(month, anchorYear, locale)}
              </Text>
              {/* Drawn on every tab, transparent on all but one: the row keeps
                  the same height whichever month is selected, so the list below
                  does not shift by three points on every move sideways. */}
              <View
                style={[
                  styles.indicator,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primary
                      : "transparent",
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * "Mai" among its own year's months, "Mai 2025" once the year differs from the
 * one being looked at — the suffix appears exactly where it disambiguates, and
 * nowhere else, because the app bar above already names the year.
 */
export function tabLabel(
  month: BudgetSparse,
  anchorYear: number | undefined,
  locale = "fr",
): string {
  const name = formatMonthName(month.month ?? 1, month.year ?? 0, locale);
  return month.year === anchorYear ? name : `${name} ${month.year}`;
}

const styles = StyleSheet.create({
  // The line a set of Material tabs sits on. It is also what tells the list
  // below where the chrome stops, which the row previously borrowed a shadow to
  // say.
  rail: { borderBottomWidth: DIVIDER_HEIGHT },
  tab: {
    minHeight: TOUCH_TARGET,
    justifyContent: "flex-end",
    // The gutter belongs to the tab rather than to the row, so the ripple and
    // the hit area cover the whole target instead of the glyph alone.
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  label: { textTransform: "capitalize", textAlign: "center" },
  indicator: {
    height: INDICATOR_HEIGHT,
    borderTopLeftRadius: INDICATOR_HEIGHT,
    borderTopRightRadius: INDICATOR_HEIGHT,
  },
});
