import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  BudgetFormulas,
  CURRENCY_METADATA,
  getBudgetPeriodDates,
  getBudgetPeriodForDate,
  type BudgetSparse,
  type SupportedCurrency,
} from "pulpe-shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { FAB, Text, useTheme } from "react-native-paper";

import { usePushOnce } from "@/core/navigation/push-once";
import {
  invalidateUserSettings,
  useUserSettings,
} from "@/core/user-settings/user-settings-queries";
import {
  areAmountsHidden,
  useAmountMasking,
} from "@/core/ui/amount-visibility";
import {
  formatCompactAmount,
  formatSignedAdaptiveCurrency,
} from "@/core/ui/amount-format";
import { formatDayMonth, formatMonthName } from "@/core/ui/date-format";
import {
  ContentZone,
  HeroAppBar,
  HeroAppBarAction,
  HeroFigure,
  HeroProgress,
  HeroVerdict,
  HeroZone,
} from "@/core/ui/hero";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { Notice } from "@/core/ui/notice";
import { useRipple } from "@/core/ui/ripple";
import { SectionHeader } from "@/core/ui/section-header";
import { useFinancialColors, useHeroColors } from "@/core/ui/scheme-colors";
import {
  BRAND_TYPE,
  FAB_CLEARANCE,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
  TOUCH_TARGET,
} from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
import {
  type BudgetTiming,
  type Period,
  budgetsOfYear,
  budgetTiming,
  budgetYears,
  initialBudgetYear,
  nextMissingMonth,
  yearRecap,
} from "@/features/budgets/budget-list-selectors";
import {
  invalidateBudgetData,
  refetchStaleBudgetList,
  useBudgetList,
} from "@/features/budgets/budget-queries";
import { budgetUsagePercentage } from "@/features/budget-details/budget-details-selectors";
import { monthSubtitle } from "@/features/budgets/month-subtitle";
import { useNow } from "@/features/current-month/current-month-queries";

/** Below this, the period is the calendar month and printing its dates says nothing. */
const CALENDAR_PAY_DAY = 1;
const MONTHS_PER_YEAR = 12;
/** The drift card's bar: the content zone's thinner sibling of the hero's. */
const USAGE_BAR_HEIGHT = 8;

/**
 * The year as a whole, then its months — `BudgetListView.swift`. The hero says
 * where the year closes and how much of it is planned; the months follow as
 * they are lived: the one in progress, the ones still ahead (the next one
 * missing included, so the way forward is in the list rather than behind an
 * icon), then the closed ones — folded in the year being lived in, since a
 * closed month is history and the list is opened for the month now.
 */
export default function BudgetsScreen() {
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const navigationResult = useLocalSearchParams<{
    createdCount?: string;
    skippedCount?: string;
    deletedMonth?: string;
  }>();
  const settings = useUserSettings();
  const budgets = useBudgetList();
  const [chosenYear, setChosenYear] = useState<number | null>(null);
  const [showsClosedMonths, setShowsClosedMonths] = useState(false);
  // Read again on every return to the foreground: a period frozen at mount
  // kept "en cours" on last month after the pay day.
  const [now, readClock] = useNow();
  const pull = usePullToRefresh(() => {
    readClock();
    return invalidateBudgetData();
  });

  // A write inside a month only marks this list stale
  // (`invalidateAfterBudgetWrite`);
  // coming to the tab is when its totals are looked at, so it asks once here.
  useFocusEffect(
    useCallback(() => {
      void refetchStaleBudgetList();
    }, []),
  );

  // A year is read whole, so every page is wanted: a year cut at a page
  // boundary would close on the wrong month. A page holds three years. Keyed on
  // the paging state alone: the query result is a new object on every render.
  // A failed page stops the reading: with it, every failure re-armed the next
  // attempt, and offline the screen asked again in a loop for as long as it
  // stayed open. The failure is the screen's to show, retry included.
  const {
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = budgets;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const currentPeriod = useMemo<Period | null>(
    () =>
      settings.data?.payDayOfMonth === undefined
        ? null
        : getBudgetPeriodForDate(now, settings.data.payDayOfMonth),
    [settings.data, now],
  );
  const years = useMemo(() => budgetYears(budgets.data ?? []), [budgets.data]);

  const createdCount = navigationCount(navigationResult.createdCount);
  const skippedCount = navigationCount(navigationResult.skippedCount);
  const showsGenerationResult = createdCount !== null && skippedCount !== null;
  const showsMonthDeleted = navigationResult.deletedMonth === "1";

  const header = (
    <HeroAppBar title={t("budgets.list.title")}>
      <HeroAppBarAction
        icon="calendar-multiple"
        onPress={() => router.push("/budget/plan")}
        accessibilityLabel={t("budgets.list.planAccessibility")}
      />
    </HeroAppBar>
  );

  if (budgets.isPending || settings.isPending) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {header}
        <HeroZone>
          <YearSkeleton />
        </HeroZone>
        <ContentZone>
          <View />
        </ContentZone>
      </View>
    );
  }

  if (
    (budgets.isError && budgets.data === undefined) ||
    isFetchNextPageError ||
    settings.data === undefined ||
    settings.data.currency === undefined ||
    settings.data.payDayOfMonth === undefined ||
    currentPeriod === null
  ) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {header}
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
      </View>
    );
  }

  const { currency, payDayOfMonth } = settings.data;
  // The chosen year only while it still has budgets: one deleted elsewhere
  // would otherwise leave the picker pointing at nothing.
  const year =
    chosenYear !== null && years.includes(chosenYear)
      ? chosenYear
      : initialBudgetYear(years, currentPeriod);
  const yearBudgets = budgetsOfYear(budgets.data ?? [], year);
  const recap = yearRecap(yearBudgets);
  const missingMonth = nextMissingMonth(yearBudgets, year, currentPeriod);
  const isPastYear = year < currentPeriod.year;
  const rows = buildRows(yearBudgets, missingMonth, year);
  // The missing month is never behind today: `nextMissingMonth` starts there.
  const timingOf = (row: ListRow): BudgetTiming =>
    row.kind === "budget" ? budgetTiming(row.budget, currentPeriod) : "future";
  const currentRows = rows.filter((row) => timingOf(row) === "current");
  const upcomingRows = rows.filter((row) => timingOf(row) === "future");
  const closedRows = rows.filter((row) => timingOf(row) === "past");
  // A past year is nothing but closed months: folding them would hide it all.
  const foldsClosed = year === currentPeriod.year;
  const monthsCard = (blockRows: ListRow[]) => (
    <LedgerCard dividerInset={SPACING.md}>
      {blockRows.map((row) =>
        row.kind === "budget" ? (
          <BudgetRow
            key={row.budget.id}
            budget={row.budget}
            currency={currency}
            payDayOfMonth={payDayOfMonth}
            timing={budgetTiming(row.budget, currentPeriod)}
            locale={locale}
            t={t}
          />
        ) : (
          <LedgerRow
            key={`missing-${row.month}`}
            testID="budgets-create-missing"
            title={capitalized(
              formatMonthName(row.month, year, locale),
              locale,
            )}
            subtitle={t("budgets.list.notCreated")}
            trailing={
              <Text
                variant="labelLarge"
                style={{ color: theme.colors.primary }}
              >
                {t("budgets.list.createMonth")}
              </Text>
            }
            onPress={() =>
              router.push({
                pathname: "/budget/create",
                params: { month: row.month, year },
              })
            }
          />
        ),
      )}
    </LedgerCard>
  );

  return (
    // The app bar carries the status bar inset; asking the safe area for the
    // top edge too would double it.
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {header}
      {years.length === 0 ? (
        <PlaceholderScreen
          icon="calendar-blank-outline"
          title={t("budgets.list.emptyTitle")}
          hint={t("budgets.list.emptyHint")}
          action={{
            label: t("budgets.list.create"),
            onPress: () => router.push("/budget/create"),
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl {...pull} />}
        >
          <HeroZone>
            {years.length > 1 && (
              <YearPicker
                years={years}
                selected={year}
                onSelect={setChosenYear}
              />
            )}
            <HeroFigure
              eyebrow={t(
                isPastYear
                  ? "budgets.list.yearReview"
                  : "budgets.list.yearBalance",
              )}
              amount={signedCompact(recap.closingBalance, currency)}
              currency={CURRENCY_METADATA[currency].symbol}
            />
            {/* The budget page's progress line: the year fills month by month,
                and the verdict under it says what the count means. */}
            <HeroProgress
              progress={recap.budgetedMonths / MONTHS_PER_YEAR}
              label={`${recap.budgetedMonths} / ${MONTHS_PER_YEAR}`}
              accessibilityLabel={`${recap.budgetedMonths} / ${MONTHS_PER_YEAR} ${t("budgets.list.budgetedMonths")}`}
            />
            <HeroVerdict
              sentence={
                recap.budgetedMonths === 0
                  ? t("budgets.list.verdict.none")
                  : recap.budgetedMonths >= MONTHS_PER_YEAR
                    ? t("budgets.list.verdict.all")
                    : t("budgets.list.verdict.some", {
                        count: recap.budgetedMonths,
                      })
              }
            />
          </HeroZone>

          <ContentZone style={styles.content}>
            {currentRows.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title={t("budgets.list.current")} />
                {monthsCard(currentRows)}
              </View>
            )}
            {upcomingRows.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title={t("budgets.list.upcoming")}
                  count={upcomingRows.length}
                />
                {monthsCard(upcomingRows)}
              </View>
            )}
            {closedRows.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title={t("budgets.list.closed")}
                  count={closedRows.length}
                  link={
                    foldsClosed
                      ? {
                          label: t(
                            showsClosedMonths
                              ? "budgets.list.hideClosed"
                              : "budgets.list.showClosed",
                          ),
                          accessibilityLabel: t(
                            showsClosedMonths
                              ? "budgets.list.hideClosedAccessibility"
                              : "budgets.list.showClosedAccessibility",
                          ),
                          icon: showsClosedMonths
                            ? "chevron-up"
                            : "chevron-down",
                          onPress: () =>
                            setShowsClosedMonths((shown) => !shown),
                        }
                      : undefined
                  }
                />
                {(!foldsClosed || showsClosedMonths) && monthsCard(closedRows)}
              </View>
            )}
          </ContentZone>
        </ScrollView>
      )}

      {/* Writing a budget happens once a month at most, so the FAB keeps to
          its plus sign: the empty state already names the action, where a
          newcomer actually is. */}
      <FAB
        testID="budgets-create"
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/budget/create")}
        accessibilityLabel={t("budgets.list.createAccessibility")}
      />

      <Notice
        clearsFab
        visible={showsGenerationResult}
        onDismiss={() =>
          router.setParams({
            createdCount: undefined,
            skippedCount: undefined,
          })
        }
      >
        {showsGenerationResult
          ? t("budgets.plan.result", {
              created: t("budgets.plan.resultCreated", {
                count: createdCount,
              }),
              skipped: t("budgets.plan.resultSkipped", {
                count: skippedCount,
              }),
            })
          : ""}
      </Notice>

      <Notice
        clearsFab
        visible={showsMonthDeleted}
        onDismiss={() => router.setParams({ deletedMonth: undefined })}
      >
        {t("budgets.list.monthDeleted")}
      </Notice>
    </View>
  );
}

type ListRow =
  | { kind: "budget"; budget: BudgetSparse }
  | { kind: "missing"; month: number };

/** The year's budgets with the next missing month slotted in at its place. */
function buildRows(
  yearBudgets: BudgetSparse[],
  missingMonth: number | null,
  year: number,
): ListRow[] {
  const rows: ListRow[] = yearBudgets.map((budget) => ({
    kind: "budget",
    budget,
  }));
  if (missingMonth === null) return rows;
  const at = rows.findIndex(
    (row) =>
      row.kind === "budget" &&
      (row.budget.year ?? year) === year &&
      (row.budget.month ?? 0) > missingMonth,
  );
  rows.splice(at === -1 ? rows.length : at, 0, {
    kind: "missing",
    month: missingMonth,
  });
  return rows;
}

/**
 * The years as Material tabs on the forest — the label over a moving indicator,
 * as the month pager draws its months — rather than a row of pills.
 */
function YearPicker({
  years,
  selected,
  onSelect,
}: {
  years: number[];
  selected: number;
  onSelect: (year: number) => void;
}) {
  const hero = useHeroColors();
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.years}
      accessibilityRole="tablist"
      accessibilityLabel={t("budgets.list.yearSelector")}
    >
      {years.map((year) => {
        const isSelected = year === selected;
        return (
          <Pressable
            key={year}
            onPress={() => onSelect(year)}
            android_ripple={{ color: hero.tile }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            style={styles.year}
          >
            <Text
              variant="titleSmall"
              style={[
                TABULAR_DIGITS,
                { color: isSelected ? hero.ink : hero.support },
              ]}
            >
              {year}
            </Text>
            <View
              style={[
                styles.yearIndicator,
                { backgroundColor: isSelected ? hero.ink : "transparent" },
              ]}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** The year's shape before its numbers, on the forest it will land on. */
function YearSkeleton() {
  const hero = useHeroColors();
  const { t } = useTranslation();
  const tone = { backgroundColor: hero.tile };

  return (
    <View
      style={styles.skeleton}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("common.loading")}
    >
      <View style={[styles.bone, styles.boneEyebrow, tone]} />
      <View style={[styles.bone, styles.boneFigure, tone]} />
      <View style={[styles.bone, styles.boneProgress, tone]} />
    </View>
  );
}

function navigationCount(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function signedCompact(value: number, currency: SupportedCurrency): string {
  if (areAmountsHidden()) return formatCompactAmount(value, currency);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatCompactAmount(Math.abs(value), currency)}`;
}

function capitalized(value: string, locale: string): string {
  return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);
}

/**
 * A month, what it leaves, and — only when the pay cycle is not the calendar —
 * the dates it actually spans. On a pay day of 1 that range restates the month
 * name, and the encouragement iOS prints there says more.
 *
 * The block a row sits in already names it in progress, ahead or closed. A
 * month that is over steps back to the quiet ink on one line, figure included —
 * it is a record, not a state; the month in progress carries the budget page's
 * consumption bar, as the one still moving.
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
  const financial = useFinancialColors();
  const ripple = useRipple();
  const push = usePushOnce();
  const month = budget.month ?? 1;
  const year = budget.year ?? new Date().getFullYear();
  const remaining = budget.remaining ?? 0;
  const isPositive = remaining >= 0;
  const isCurrent = timing === "current";
  const isPast = timing === "past";
  const state = BudgetFormulas.emotionState(budget);
  const amountColor = isPast
    ? theme.colors.onSurfaceVariant
    : state === "comfortable"
      ? theme.colors.primary
      : state === "tight"
        ? financial.expense
        : financial.overBudget;
  const name = capitalized(formatMonthName(month, year, locale), locale);
  const usagePercentage = budgetUsagePercentage({
    totalExpenses: budget.totalExpenses ?? 0,
    available: (budget.totalIncome ?? 0) + (budget.rollover ?? 0),
  });

  return (
    <Pressable
      testID={`budget-row-${budget.id}`}
      onPress={() => push(`/budget/${budget.id}`)}
      android_ripple={ripple}
      accessibilityRole="button"
      style={styles.row}
    >
      <View style={styles.rowLine}>
        <View style={styles.rowText}>
          <Text
            variant="titleMedium"
            style={{
              color: isPast
                ? theme.colors.onSurfaceVariant
                : theme.colors.onSurface,
            }}
          >
            {name}
          </Text>
          {!isPast && (
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {periodLabel(t, locale, month, year, payDayOfMonth, isPositive)}
            </Text>
          )}
        </View>

        <View style={styles.amount}>
          <Text
            numberOfLines={1}
            style={[
              BRAND_TYPE.rowAmount,
              TABULAR_DIGITS,
              { color: amountColor },
            ]}
          >
            {formatSignedAdaptiveCurrency(remaining, currency)}
          </Text>
          {/* « Potentiel » and « Ajustement » say what can still be done with
              the money; a closed month only keeps its figure. */}
          {!isPast && (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {isPositive
                ? t("budgets.list.potential")
                : t("budgets.list.adjustment")}
            </Text>
          )}
        </View>
      </View>

      {isCurrent && (
        <View style={styles.usage}>
          <View
            style={[
              styles.usageTrack,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <View
              style={[
                styles.usageFill,
                {
                  backgroundColor: amountColor,
                  width: `${Math.min(Math.max(usagePercentage, 0), 100)}%`,
                },
              ]}
            />
          </View>
          <Text
            variant="labelMedium"
            style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
          >
            {`${Math.round(usagePercentage)} %`}
          </Text>
        </View>
      )}
    </Pressable>
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
  scroll: { flexGrow: 1 },
  content: { paddingBottom: FAB_CLEARANCE },
  section: { gap: SPACING.sm },
  // The hero's gutter moves onto each tab, so the first label lines up with the
  // figure below while its target still reaches the display edge.
  years: { marginHorizontal: -SPACING.md, flexGrow: 0 },
  year: {
    minHeight: TOUCH_TARGET,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  /** M3's primary tab indicator. */
  yearIndicator: {
    alignSelf: "stretch",
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  row: {
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: 64,
    paddingVertical: SPACING.sm + SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  rowLine: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  usage: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  usageTrack: {
    flex: 1,
    height: USAGE_BAR_HEIGHT,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  usageFill: { height: "100%", borderRadius: RADIUS.full },
  rowText: { flex: 1, gap: SPACING.xxs },
  amount: { alignItems: "flex-end", gap: SPACING.xxs },
  skeleton: { gap: SPACING.md },
  bone: { borderRadius: RADIUS.sm },
  boneEyebrow: { width: 140, height: 14 },
  boneFigure: { width: 180, height: 48 },
  boneProgress: { alignSelf: "stretch", height: 10, borderRadius: RADIUS.full },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
