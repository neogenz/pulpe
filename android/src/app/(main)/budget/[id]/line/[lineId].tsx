import { router, useLocalSearchParams } from "expo-router";
import {
  BudgetFormulas,
  CURRENCY_METADATA,
  type SupportedCurrency,
} from "pulpe-shared";
import { useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  FAB,
  Menu,
  Text,
  useTheme,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { KIND_ICONS, recurrenceLabel } from "@/core/ui/vocabulary";
import { useTranslation } from "@/core/i18n/locale-store";
import { IconDisc } from "@/core/ui/icon-disc";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import { SectionHeader } from "@/core/ui/section-header";

import { useTags } from "@/features/tags/tag-queries";
import { tagSummary } from "@/features/tags/tag-selection";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatAmount, formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { InlineQueryError } from "@/core/ui/inline-query-error";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import {
  BRAND_TYPE,
  FAB_CLEARANCE,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
import {
  useBudgetDetails,
  useBudgetPeriods,
} from "@/features/budgets/budget-queries";
import {
  usePendingCheck,
  useToggleCheck,
} from "@/features/budgets/toggle-check-mutation";
import {
  hasBudgetForPeriod,
  isPostponeEligible,
  postponeTargetPeriod,
} from "@/features/budget-details/postpone-gate";
import { TransactionRow } from "@/features/budget-details/components/transaction-row";
import {
  BudgetLineDetailOverlays,
  type BudgetLineDetailOverlaysHandle,
} from "@/features/budget-details/components/budget-line-detail-overlays";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";
const PERCENT = 100;
const PROGRESS_HEIGHT = 8;

/**
 * One envelope and everything booked against it. The list here is the answer to
 * the row's amount: it says *where* the money went, which the parent screen has
 * no room to.
 */
export default function BudgetLineDetailScreen() {
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const { id, lineId } = useLocalSearchParams<{ id: string; lineId: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { locale, t } = useTranslation();
  const financial = useFinancialColors();
  const settings = useUserSettings();
  const details = useBudgetDetails(id);
  const targetPeriods = useBudgetPeriods(
    details.data === undefined
      ? null
      : postponeTargetPeriod(details.data.budget).year,
  );
  const tags = useTags();
  const toggle = useToggleCheck(id);
  const isPendingCheck = usePendingCheck(id);
  const pull = usePullToRefresh(() => details.refetch());
  const overlays = useRef<BudgetLineDetailOverlaysHandle>(null);
  const [isMenuOpen, setMenuOpen] = useState(false);

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;

  if (details.isPending || settings.isPending) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </SafeAreaView>
    );
  }

  if (details.isError || settings.isError) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <InlineQueryError
          message={t("budgets.actions.line.loadError")}
          onRetry={() =>
            void Promise.all([details.refetch(), settings.refetch()])
          }
        />
      </SafeAreaView>
    );
  }

  const budget = details.data?.budget;
  const line = details.data?.budgetLines.find((row) => row.id === lineId);

  if (line === undefined || budget === undefined) {
    return (
      <PlaceholderScreen
        icon="receipt-text-remove-outline"
        title={t("budgets.actions.line.missingTitle")}
        hint={t("budgets.actions.line.missingHint")}
        action={{ label: t("common.back"), onPress: () => router.back() }}
      />
    );
  }

  const transactions = (details.data?.transactions ?? []).filter(
    (transaction) => transaction.budgetLineId === lineId,
  );
  const consumption = BudgetFormulas.calculateConsumption(line, transactions);
  const postponeTarget = postponeTargetPeriod({
    year: budget.year,
    month: budget.month,
  });
  // Only claim the month is missing once the period lookup has answered:
  // pending, the entry stays live and a real failure still speaks for itself.
  const isPostponeTargetMissing =
    targetPeriods.isSuccess &&
    !hasBudgetForPeriod(targetPeriods.data, postponeTarget);
  const accent =
    line.kind === "expense" && consumption.available < 0
      ? financial.overBudget
      : financial[
          line.kind === "income"
            ? "income"
            : line.kind === "saving"
              ? "savings"
              : "expense"
        ];

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel={t("common.back")}
        />
        <Appbar.Content title={line.name} />
        <Menu
          visible={isMenuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              onPress={() => setMenuOpen(true)}
              accessibilityLabel={t("budgets.actions.line.actions")}
            />
          }
        >
          <Menu.Item
            leadingIcon="pencil"
            title={t("budgets.mutations.edit")}
            onPress={() => {
              setMenuOpen(false);
              overlays.current?.editLine();
            }}
          />
          {line.spreadGroupId != null && (
            <Menu.Item
              leadingIcon="calendar-multiple"
              title={t("budgets.actions.line.viewSpread")}
              onPress={() => {
                setMenuOpen(false);
                overlays.current?.showOccurrences();
              }}
            />
          )}
          {/* Spreading redistributes a one-off's own total forward. A recurring
              forecast already spans months, and a revenue has no shape to
              spread — both are out by the endpoint's own rules. */}
          {line.spreadGroupId == null &&
            line.recurrence === "one_off" &&
            line.kind !== "income" && (
              <Menu.Item
                leadingIcon="calendar-multiple"
                title={t("budgets.mutations.forecast.spreadTitle")}
                onPress={() => {
                  setMenuOpen(false);
                  overlays.current?.showSpread();
                }}
              />
            )}
          {/* The endpoint refuses six shapes of line outright, and no amount of
              retrying changes any of them — so the entry is simply not there.
              The seventh refusal, a next month that was never created, is the
              user's to lift: it stays on screen and says how. */}
          {isPostponeEligible(line, transactions.length) && (
            <Menu.Item
              leadingIcon={
                isPostponeTargetMissing
                  ? "calendar-alert"
                  : "calendar-arrow-right"
              }
              title={
                isPostponeTargetMissing
                  ? t("budgets.actions.line.createTargetBudget", {
                      month: formatMonthName(
                        postponeTarget.month,
                        postponeTarget.year,
                        locale,
                      ),
                    })
                  : t("budgets.actions.line.postpone")
              }
              disabled={isPostponeTargetMissing}
              onPress={() => {
                setMenuOpen(false);
                overlays.current?.postpone();
              }}
            />
          )}
          <Menu.Item
            leadingIcon="trash-can-outline"
            title={t("budgets.mutations.delete")}
            onPress={() => {
              setMenuOpen(false);
              overlays.current?.confirmDelete();
            }}
          />
        </Menu>
      </ScreenAppBar>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl {...pull} />}
      >
        {/* What is left, in the size the screen exists for, then how much of
            the plan is already gone — the same reading order as iOS's line
            page, on the canvas: an envelope has no verdict of its own. */}
        <View
          style={[styles.summary, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.kind}>
            <IconDisc name={KIND_ICONS[line.kind]} tint={accent} />
            <Text
              variant="labelLarge"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t(`vocabulary.kind.${line.kind}`)} ·{" "}
              {recurrenceLabel(t, line.recurrence)}
            </Text>
          </View>

          <View style={styles.figure}>
            <Text
              variant="labelLarge"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t(
                consumption.available >= 0
                  ? "budgets.actions.line.leftEyebrow"
                  : "budgets.actions.line.overrunEyebrow",
              )}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={[
                BRAND_TYPE.heroFigure,
                TABULAR_DIGITS,
                {
                  color:
                    consumption.available >= 0
                      ? theme.colors.onSurface
                      : financial.overBudget,
                },
              ]}
            >
              {formatAmount(Math.abs(consumption.available), currency)}
              <Text
                style={[
                  BRAND_TYPE.heroCurrency,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {` ${CURRENCY_METADATA[currency].symbol}`}
              </Text>
            </Text>
          </View>

          <View style={styles.progressRow}>
            <View
              style={[
                styles.track,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <View
                style={[
                  styles.fill,
                  {
                    backgroundColor: accent,
                    width: `${Math.min(Math.max(consumption.percentage, 0), PERCENT)}%`,
                  },
                ]}
              />
            </View>
            <Text
              variant="labelLarge"
              style={[TABULAR_DIGITS, { color: accent }]}
            >
              {`${Math.round(consumption.percentage)} %`}
            </Text>
          </View>

          <Text
            variant="bodyMedium"
            style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
          >
            {t("budgets.actions.line.notedOf", {
              noted: formatCurrency(consumption.allocated, currency),
              planned: formatCurrency(line.amount, currency),
            })}
          </Text>
        </View>

        <SectionHeader
          title={t("budgets.actions.line.movements")}
          count={transactions.length}
        />

        {transactions.length === 0 ? (
          <LedgerCard>
            <LedgerRow
              leading={
                <IconDisc name="tray" tint={theme.colors.onSurfaceVariant} />
              }
              title={t("budgets.actions.line.emptyTitle")}
              subtitle={t("budgets.actions.line.empty")}
            />
          </LedgerCard>
        ) : (
          <LedgerCard>
            {transactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                currency={currency}
                isSyncing={isPendingCheck({
                  source: "transaction",
                  sourceId: transaction.id,
                })}
                tagSummary={tagSummary(
                  transaction.tagIds ?? [],
                  tags.data ?? [],
                )}
                onPress={() => overlays.current?.editTransaction(transaction)}
                onToggle={() =>
                  void toggle
                    .mutateAsync({
                      source: "transaction",
                      sourceId: transaction.id,
                    })
                    // Per call: `mutate`'s callbacks belong to the latest call alone,
                    // so a failure on a row pointed just before another went unsaid.
                    .catch(() => overlays.current?.showToggleFailure())
                }
              />
            ))}
          </LedgerCard>
        )}
      </ScrollView>

      {/* Allocating happens here and only here: the envelope being filled is
          on screen, so nothing has to be picked from a list of them. It is the
          act this page is for, so its FAB names itself. */}
      <FAB
        icon="plus"
        testID="line-add-activity"
        label={t("budgets.actions.line.note")}
        // An absolute child sits outside the safe area's padding: without the
        // inset, the FAB lands on the gesture bar.
        style={[styles.fab, { bottom: SPACING.md + insets.bottom }]}
        onPress={() => overlays.current?.addTransaction()}
      />

      <BudgetLineDetailOverlays
        ref={overlays}
        budgetId={id}
        period={{ year: budget.year, month: budget.month }}
        currency={currency}
        payDayOfMonth={payDayOfMonth}
        line={line}
        transactions={transactions}
        onLeave={() => router.back()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
    paddingBottom: FAB_CLEARANCE,
  },
  summary: {
    borderRadius: RADIUS.card,
    padding: SPACING.md,
    gap: SPACING.sm + SPACING.xs,
  },
  kind: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  figure: { gap: SPACING.xxs },
  progressRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  track: {
    flex: 1,
    height: PROGRESS_HEIGHT,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: RADIUS.full },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
