import { BudgetFormulas } from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { areAmountsHidden } from "@/core/ui/amount-visibility";
import { LedgerCard } from "@/core/ui/ledger";
import { Notice } from "@/core/ui/notice";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
import { SectionHeader } from "@/core/ui/section-header";
import { useV2Colors } from "@/core/ui/scheme-colors";
import { RADIUS, SPACING } from "@/core/ui/theme";

import { sortNewestFirst } from "../activity-window";
import { isPointableLine, orderForChecking } from "../current-month-view-model";
import {
  isPointedNow,
  lineFact,
  toPointMovementFact,
} from "../home-presentation";
import { useMovementEditor } from "../use-movement-editor";
import { usePointingNotice } from "../use-pointing-notice";
import { type LoadedMonth, MonthPage } from "./month-page";
import { PointRow } from "./point-row";
import { ReconcileAccountsSheet } from "./reconcile-accounts-sheet";

/**
 * What is left to point: the pointed balance that moves with each circle, then
 * the movements and the forecasts waiting for it. A row that was just pointed
 * stays where it is, saying so, until the page is left. `ToPointPage` on iOS.
 */
export function ToPointPage() {
  const { t } = useTranslation();

  return (
    <MonthPage title={t("home.toPoint.title")}>
      {(month) => <ToPoint month={month} />}
    </MonthPage>
  );
}

function ToPoint({ month }: { month: LoadedMonth }) {
  const theme = useTheme();
  const v2 = useV2Colors();
  const { locale, t } = useTranslation();
  const pull = usePullToRefresh(() => month.refresh());
  const pointing = usePointingNotice(month.budgetId);
  const editor = useMovementEditor(
    month.budgetId,
    month.currency,
    month.period,
  );
  const { currency, viewModel } = month;
  const { transactions, budgetLines, budget, checkingDays } = month.details;
  const balance = viewModel.realized.realizedBalance;
  // The pointed balance when the page opened: struck through once pointing moved it.
  const [openingBalance] = useState(balance);
  // Ids pointed from this page; their rows stay until it is left.
  const [pointedHere, setPointedHere] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [isReconciling, setReconciling] = useState(false);
  const [reconcileNotice, setReconcileNotice] = useState<string | null>(null);

  const lineNames = new Map(budgetLines.map((line) => [line.id, line.name]));
  const movements = sortNewestFirst(
    transactions.filter(
      (transaction) =>
        transaction.checkedAt === null || pointedHere.has(transaction.id),
    ),
  );
  const lines = orderForChecking(
    budgetLines.filter(
      (line) =>
        isPointableLine(line) &&
        (line.checkedAt === null || pointedHere.has(line.id)),
    ),
    checkingDays,
    viewModel.periodProgress.day,
  );
  const remaining = movements.filter((item) => item.checkedAt === null).length;
  const now = new Date();

  function toggle(
    item: {
      source: "transaction" | "budgetLine";
      sourceId: string;
      name: string;
    },
    wasPointed: boolean,
  ) {
    if (wasPointed) {
      setPointedHere((current) => {
        const next = new Set(current);
        next.delete(item.sourceId);
        return next;
      });
      void pointing.point(item, true);
      return;
    }
    // Kept before the row flips, or it leaves the page and comes back.
    setPointedHere((current) => new Set(current).add(item.sourceId));
    void pointing.point(item).then((isKept) => {
      if (isKept) return;
      setPointedHere((current) => {
        const next = new Set(current);
        next.delete(item.sourceId);
        return next;
      });
    });
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl {...pull} />}
      >
        <Text
          variant="bodyLarge"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("home.toPoint.subtitle")}
        </Text>

        <View
          testID="to-point-balance-card"
          style={[
            styles.balanceCard,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <View style={styles.balanceHeader}>
            <Text
              variant="labelLarge"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("home.toPoint.balance")}
            </Text>
            <Button
              mode="text"
              compact
              testID="to-point-compare"
              onPress={() => setReconciling(true)}
              style={styles.compare}
            >
              {t("home.toPoint.compare")}
            </Button>
          </View>
          <View style={styles.balanceFigure}>
            <Amount size="hero" numberOfLines={1} style={styles.balanceAmount}>
              {formatCurrency(balance, currency)}
            </Amount>
            {openingBalance !== balance && !areAmountsHidden() && (
              <Amount size="row" tone="muted" style={styles.struck}>
                {formatCurrency(openingBalance, currency)}
              </Amount>
            )}
          </View>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("home.toPoint.balanceHint")}
          </Text>
        </View>

        {movements.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={t("home.movements.title")}
              subtitle={t("home.toPoint.remaining", { count: remaining })}
            />
            <LedgerCard>
              {movements.map((transaction) => {
                const isChecked = transaction.checkedAt !== null;
                return (
                  <PointRow
                    key={transaction.id}
                    title={transaction.name}
                    subtitle={toPointMovementFact(
                      t,
                      locale,
                      transaction,
                      transaction.budgetLineId === null
                        ? undefined
                        : lineNames.get(transaction.budgetLineId),
                      isPointedNow(pointedHere, transaction.id, isChecked),
                      now,
                    )}
                    amount={formatCurrency(transaction.amount, currency)}
                    kind={transaction.kind}
                    isPointed={isChecked}
                    isSyncing={pointing.isPending({
                      source: "transaction",
                      sourceId: transaction.id,
                    })}
                    onToggle={() =>
                      toggle(
                        {
                          source: "transaction",
                          sourceId: transaction.id,
                          name: transaction.name,
                        },
                        isChecked,
                      )
                    }
                    onOpen={() => editor.edit(transaction)}
                  />
                );
              })}
            </LedgerCard>
          </View>
        )}

        {lines.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={t("home.toPoint.forecasts")}
              count={lines.length}
              subtitle={t("home.toPoint.forecastsHint")}
            />
            <LedgerCard>
              {lines.map((line) => {
                const fact = lineFact(
                  t,
                  line,
                  BudgetFormulas.calculateConsumption(line, transactions),
                  currency,
                );
                const isChecked = line.checkedAt !== null;
                return (
                  <PointRow
                    key={line.id}
                    title={line.name}
                    subtitle={
                      fact.hasAmount && areAmountsHidden()
                        ? undefined
                        : fact.text
                    }
                    isOverrun={fact.isOverrun}
                    amount={formatCurrency(line.amount, currency)}
                    kind={line.kind}
                    isPointed={isChecked}
                    isSyncing={pointing.isPending({
                      source: "budgetLine",
                      sourceId: line.id,
                    })}
                    onToggle={() =>
                      toggle(
                        {
                          source: "budgetLine",
                          sourceId: line.id,
                          name: line.name,
                        },
                        isChecked,
                      )
                    }
                    onOpen={() => router.push(`/budget/${budget.id}`)}
                  />
                );
              })}
            </LedgerCard>
          </View>
        )}

        {movements.length === 0 && lines.length === 0 && (
          <View style={[styles.done, { backgroundColor: v2.sunk }]}>
            <Text
              variant="bodyLarge"
              style={[
                styles.doneText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {t("home.toPoint.done")}
            </Text>
          </View>
        )}
      </ScrollView>

      <ReconcileAccountsSheet
        isVisible={isReconciling}
        onDismiss={() => setReconciling(false)}
        onRecorded={() => {
          setReconciling(false);
          setReconcileNotice("home.reconcile.recorded");
        }}
        onRecordFailed={() =>
          setReconcileNotice("budgets.mutations.activity.error")
        }
        onViewItemsToCheck={() => setReconciling(false)}
        budgetId={budget.id}
        month={{
          realized: viewModel.realized,
          rollover: budget.rollover ?? 0,
          period: month.period,
        }}
        currency={currency}
      />
      <Notice
        clearsFab
        visible={reconcileNotice !== null}
        onDismiss={() => setReconcileNotice(null)}
      >
        {reconcileNotice === null ? "" : t(reconcileNotice)}
      </Notice>
      {pointing.element}
      {editor.element}
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xl },
  balanceCard: {
    borderRadius: RADIUS.zone,
    padding: SPACING.md + SPACING.xs,
    gap: SPACING.sm,
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  compare: { marginRight: -SPACING.sm },
  balanceFigure: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: SPACING.sm,
  },
  balanceAmount: { flexShrink: 1 },
  struck: { textDecorationLine: "line-through" },
  section: { gap: SPACING.sm + SPACING.xs },
  done: { borderRadius: RADIUS.card, padding: SPACING.xl },
  doneText: { textAlign: "center" },
});
