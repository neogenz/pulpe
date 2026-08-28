import { router } from "expo-router";
import {
  getBudgetPeriodDates,
  getBudgetPeriodForDate,
  type BudgetSparse,
  type SupportedCurrency,
} from "pulpe-shared";
import { useCallback, useMemo, useRef } from "react";
import { RefreshControl, SectionList, StyleSheet, View } from "react-native";
import { ActivityIndicator, FAB, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  invalidateUserSettings,
  useUserSettings,
} from "@/core/user-settings/user-settings-queries";
import { Card } from "@/core/ui/card";
import { Amount } from "@/core/ui/amount";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatSignedCompactCurrency } from "@/core/ui/amount-format";
import { formatDayMonth, formatMonthName } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { StatusBadge } from "@/core/ui/status-badge";
import { FAB_CLEARANCE, SPACING } from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";
import {
  type BudgetTiming,
  budgetTiming,
  budgetYearSections,
  currentBudgetLocation,
} from "@/features/budgets/budget-list-selectors";
import {
  invalidateBudgetData,
  useBudgetList,
} from "@/features/budgets/budget-queries";
import { monthSubtitle } from "@/features/budgets/month-subtitle";

/** Below this, the period is the calendar month and printing its dates says nothing. */
const CALENDAR_PAY_DAY = 1;

/**
 * Twice the hairline Paper draws around an outlined card, so the month being
 * lived in reads as the same shape drawn harder rather than as a different one.
 */
const CURRENT_MONTH_BORDER = 2;

/** `VirtualizedList`'s own default, kept as the floor rather than lowered. */
const DEFAULT_RENDER_WINDOW = 10;

interface BudgetYearGroup {
  year: number;
  data: BudgetSparse[];
}

export default function BudgetsScreen() {
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const settings = useUserSettings();
  const budgets = useBudgetList();

  // Derived above the gates below, and the anchor with it: the loading and error
  // returns sit between here and the list, and a hook declared past an early
  // return is a hook the next render may not reach.
  const sections = useMemo(
    () => budgetYearSections(budgets.data ?? []),
    [budgets.data],
  );
  const groups = useMemo<BudgetYearGroup[]>(
    () =>
      sections.map((section) => ({
        year: section.year,
        data: section.budgets,
      })),
    [sections],
  );
  const currentPeriod = useMemo(
    () =>
      settings.data?.payDayOfMonth === undefined
        ? null
        : getBudgetPeriodForDate(new Date(), settings.data.payDayOfMonth),
    [settings.data],
  );
  const anchor = useMemo(
    () =>
      currentPeriod === null
        ? null
        : currentBudgetLocation(sections, currentPeriod),
    [sections, currentPeriod],
  );

  const list = useRef<SectionList<BudgetSparse, BudgetYearGroup>>(null);
  const hasAnchored = useRef(false);

  const scrollToAnchor = useCallback(() => {
    if (anchor === null) return;
    list.current?.scrollToLocation({
      sectionIndex: anchor.sectionIndex,
      // `+ 1` because `SectionList` counts the year header as row `0` of its
      // own section, where the selector counts budgets. Passing the budget's
      // own index lands the list a card early — the month above the one being
      // lived in. Kept here rather than in the selector: this is the list
      // component's own numbering, not something the domain knows about.
      itemIndex: anchor.itemIndex + 1,
      viewPosition: 0,
      // No clearance of our own: `scrollToLocation` measures the sticky year
      // header and adds it to `viewOffset` itself, so a second allowance for
      // it would push the card that far below the header instead of under it.
      animated: false,
    });
  }, [anchor]);

  // The list reads newest first, so the months still to come sit *above* the one
  // being lived in — an account provisioned a year ahead opened twelve cards
  // away from the only month anyone can act on.
  //
  // Driven by the list's own measurement rather than by a mount effect: asking
  // it to scroll from inside the commit that mounts it moves rows the mounting
  // is still placing, and Fabric answers that with "The specified child already
  // has a parent" — a native crash on the tab, not a misplaced scroll. Once, and
  // only once: re-anchoring after a pull-to-refresh would take the list back
  // from under the thumb.
  const anchorList = useCallback(() => {
    if (anchor === null || hasAnchored.current) return;
    hasAnchored.current = true;
    scrollToAnchor();
  }, [anchor, scrollToAnchor]);

  if (budgets.isPending || settings.isPending) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </SafeAreaView>
    );
  }

  if (
    budgets.isError ||
    settings.isError ||
    settings.data === undefined ||
    settings.data.currency === undefined ||
    settings.data.payDayOfMonth === undefined ||
    currentPeriod === null
  ) {
    return (
      <PlaceholderScreen
        icon="cloud-off-outline"
        title={t("budgets.list.loadErrorTitle")}
        hint={t("budgets.list.loadErrorHint")}
        action={{
          label: t("common.retry"),
          onPress: () =>
            void Promise.all([
              invalidateUserSettings(),
              invalidateBudgetData(),
            ]),
        }}
      />
    );
  }

  if (sections.length === 0) {
    return (
      <PlaceholderScreen
        icon="calendar-blank-outline"
        title={t("budgets.list.emptyTitle")}
        hint={t("budgets.list.emptyHint")}
        action={{
          label: t("budgets.list.create"),
          onPress: () => router.push("/budget/create"),
        }}
      />
    );
  }

  const { currency, payDayOfMonth } = settings.data;

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      {/* Sectioned rather than flat: an account two years old is 24 months of
          cards, and mounting all of them to show four is the frame drop the
          list opens on. `SectionList` is the virtualiser that already speaks
          year-then-months, so nothing has to be flattened by hand. */}
      <SectionList
        ref={list}
        sections={groups}
        keyExtractor={(budget) => budget.id}
        contentContainerStyle={styles.content}
        onContentSizeChange={anchorList}
        // Not optional, whatever is on screen: `scrollToIndex` refuses outright
        // unless one of these two is present, and it throws rather than returns
        // — which on this tab came out as a native mounting crash, not a scroll
        // that quietly did nothing. These cards have no fixed height (a subtitle
        // wraps, a badge does not), so `getItemLayout` would have to lie; the
        // honest half of the pair is to answer the failure. It means the row is
        // rendered but not yet measured, and one frame later it is.
        onScrollToIndexFailed={() => {
          requestAnimationFrame(scrollToAnchor);
        }}
        // What makes that second attempt land: the row has to exist to be
        // measured, and the window stops well short of a year of months.
        initialNumToRender={
          anchor === null
            ? undefined
            : Math.max(DEFAULT_RENDER_WINDOW, anchor.rowsAbove + 1)
        }
        // Off by default on Android, on by default on iOS. A year is the one
        // thing a month card never says, so scrolling into 2025 without it
        // leaves twelve "Décembre" with nothing to date them.
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl
            refreshing={budgets.isRefetching}
            onRefresh={() => void invalidateBudgetData()}
          />
        }
        onEndReached={() => {
          if (budgets.hasNextPage && !budgets.isFetchingNextPage) {
            void budgets.fetchNextPage();
          }
        }}
        ListFooterComponent={
          budgets.isFetchingNextPage ? (
            <ActivityIndicator accessibilityLabel={t("common.loading")} />
          ) : null
        }
        ListHeaderComponent={
          <Text variant="headlineSmall" style={styles.screenTitle}>
            {t("budgets.list.title")}
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <Text
            variant="titleSmall"
            style={[
              styles.year,
              {
                color: theme.colors.onSurfaceVariant,
                backgroundColor: theme.colors.background,
              },
            ]}
          >
            {section.year}
          </Text>
        )}
        renderItem={({ item: budget }) => (
          <View style={styles.row}>
            <BudgetRow
              budget={budget}
              currency={currency}
              payDayOfMonth={payDayOfMonth}
              timing={budgetTiming(budget, currentPeriod)}
              locale={locale}
              t={t}
            />
          </View>
        )}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/budget/create")}
        accessibilityLabel={t("budgets.list.createAccessibility")}
      />
    </SafeAreaView>
  );
}

/**
 * A month, what it leaves, and — only when the pay cycle is not the calendar —
 * the dates it actually spans. On a pay day of 1 that range restates the month
 * name, and the encouragement iOS prints there says more.
 */
function BudgetRow({
  budget,
  currency,
  payDayOfMonth,
  timing,
  locale,
  t,
}: {
  budget: BudgetSparse;
  currency: SupportedCurrency;
  payDayOfMonth: number | null;
  timing: BudgetTiming;
  locale: string;
  t: (key: string) => string;
}) {
  const theme = useTheme();
  const month = budget.month ?? 1;
  const year = budget.year ?? new Date().getFullYear();
  const remaining = budget.remaining ?? 0;
  const isPositive = remaining >= 0;
  const isCurrent = timing === "current";
  const isPast = timing === "past";

  return (
    <Card
      // Three weights for three meanings: the month being lived in is raised
      // and ringed, a plan is only outlined, and a month that is over is a flat
      // filled surface. The surface carries it on its own — the 0.72 opacity
      // that used to sit on top took "Résultat" down to 3.64:1, and a month
      // already lived is exactly the one someone re-reads.
      //
      // The ring is what makes "raised" legible. `background` is #F7F6F3 and
      // `surface` is #FFFFFF, so an outlined card is white against warm grey
      // with a crisp edge, while an elevated one is a faint tint under a soft
      // Android shadow — on this background elevation is the *weakest* of the
      // three, and the current month ended up quieter than the plans above it.
      // Drawing its edge in `primary` is the app's own way of saying "this one"
      // (`budget/create.tsx` marks the chosen model the same way), and it does
      // it without tinting a surface: filling the card with `primaryContainer`
      // is what put the loudest colour in the palette on a list row and left
      // the text below on roles resolved for a neutral one.
      mode={isCurrent ? "elevated" : isPast ? "contained" : "outlined"}
      style={
        isCurrent && {
          borderWidth: CURRENT_MONTH_BORDER,
          borderColor: theme.colors.primary,
        }
      }
      onPress={() => router.push(`/budget/${budget.id}`)}
    >
      <Card.Content style={styles.cardRow}>
        <View style={styles.rowLabels}>
          {/* Beside the month, not above it: stacked, the badge pushed "Août"
              off the line every other month name shares with its amount, and a
              list read by scanning down one column cannot afford one row that
              sits lower than the rest. */}
          <View style={styles.monthLine}>
            <Text variant="titleMedium" style={styles.month}>
              {formatMonthName(month, year, locale)}
            </Text>
            {isCurrent && (
              <StatusBadge>{t("budgets.list.current")}</StatusBadge>
            )}
          </View>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {periodLabel(t, locale, month, year, payDayOfMonth, isPositive)}
          </Text>
        </View>

        <View style={styles.amount}>
          <Amount size="row">
            {formatSignedCompactCurrency(remaining, currency)}
          </Amount>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {/* A month that is over settled at this figure; the two other
                tenses are still describing something that has not happened. */}
            {isPast
              ? t("budgets.list.result")
              : isPositive
                ? t("budgets.list.potential")
                : t("budgets.list.adjustment")}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function periodLabel(
  t: (key: string) => string,
  locale: string,
  month: number,
  year: number,
  payDayOfMonth: number | null,
  isPositive: boolean,
): string {
  if (payDayOfMonth === null || payDayOfMonth <= CALENDAR_PAY_DAY) {
    return monthSubtitle(t, month, isPositive);
  }
  const { startDate, endDate } = getBudgetPeriodDates(
    month,
    year,
    payDayOfMonth,
  );
  return `${formatDayMonth(startDate, locale)} – ${formatDayMonth(endDate, locale)}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Rhythm per row, not a container `gap`: a virtualised list has no single
  // container to hold one.
  content: { padding: SPACING.md, paddingBottom: FAB_CLEARANCE },
  screenTitle: { paddingBottom: SPACING.md },
  // Opaque, because a sticky header scrolls over the cards underneath it.
  year: { paddingTop: SPACING.sm, paddingBottom: SPACING.sm },
  row: { paddingBottom: SPACING.sm },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  rowLabels: { flex: 1, gap: SPACING.xxs },
  monthLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  month: { textTransform: "capitalize" },
  amount: { alignItems: "flex-end", gap: SPACING.xxs },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
