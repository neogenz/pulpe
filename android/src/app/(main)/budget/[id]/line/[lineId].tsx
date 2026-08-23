import { router, useLocalSearchParams } from "expo-router";
import { BudgetFormulas, type SupportedCurrency } from "pulpe-shared";
import { useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Menu,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { recurrenceLabel } from "@/core/ui/vocabulary";
import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";

import { useTags } from "@/features/tags/tag-queries";
import { tagSummary } from "@/features/tags/tag-selection";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { InlineQueryError } from "@/core/ui/inline-query-error";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { SPACING } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import {
  useBudgetDetails,
  useBudgetPeriods,
} from "@/features/budgets/budget-queries";
import { useToggleCheck } from "@/features/budgets/toggle-check-mutation";
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
        <Appbar.BackAction onPress={() => router.back()} />
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
        refreshControl={
          <RefreshControl
            refreshing={details.isRefetching}
            onRefresh={() => void details.refetch()}
          />
        }
      >
        <View style={styles.hero}>
          <Text
            variant="labelLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t(`vocabulary.kind.${line.kind}`)} ·{" "}
            {recurrenceLabel(t, line.recurrence).toLocaleLowerCase(locale)}
          </Text>

          <Amount size="hero" style={{ color: accent }} numberOfLines={1}>
            {formatCurrency(consumption.allocated, currency)}
          </Amount>

          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("budgets.actions.line.plannedAmount", {
              amount: formatCurrency(line.amount, currency),
            })}
          </Text>

          <ProgressBar
            progress={Math.min(consumption.percentage / PERCENT, 1)}
            color={accent}
            style={styles.progress}
          />

          <Amount size="row">
            {consumption.available >= 0
              ? t("budgets.actions.line.remaining", {
                  amount: formatCurrency(consumption.available, currency),
                })
              : t("budgets.actions.line.overrun", {
                  amount: formatCurrency(-consumption.available, currency),
                })}
          </Amount>
        </View>

        <Text variant="titleSmall">
          {t(
            `budgets.actions.line.${transactions.length === 0 ? "activityNone" : transactions.length === 1 ? "activityOne" : "activityMany"}`,
            { count: transactions.length },
          )}
        </Text>

        {transactions.length === 0 ? (
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("budgets.actions.line.empty")}
          </Text>
        ) : (
          transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              currency={currency}
              isSyncing={
                toggle.isPending &&
                toggle.variables?.sourceId === transaction.id
              }
              tagSummary={tagSummary(transaction.tagIds ?? [], tags.data ?? [])}
              onPress={() => overlays.current?.editTransaction(transaction)}
              onToggle={() =>
                toggle.mutate(
                  { source: "transaction", sourceId: transaction.id },
                  { onError: () => overlays.current?.showToggleFailure() },
                )
              }
            />
          ))
        )}

        {/* Allocating happens here and only here: the envelope being filled is
            on screen, so nothing has to be picked from a list of them. */}
        <Button
          mode="outlined"
          icon="plus"
          onPress={() => overlays.current?.addTransaction()}
          style={styles.add}
        >
          {t("budgets.mutations.activity.createTitle")}
        </Button>
      </ScrollView>

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
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  hero: { gap: SPACING.xs },
  progress: { height: SPACING.sm, borderRadius: SPACING.xs },
  add: { marginTop: SPACING.sm },
});
