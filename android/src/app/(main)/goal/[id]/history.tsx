import { router, useLocalSearchParams } from "expo-router";
import type { SupportedCurrency } from "pulpe-shared";
import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Divider, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { formatAmount, formatCurrency } from "@/core/ui/amount-format";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatInstantDay, formatMonthLabel } from "@/core/ui/date-format";
import { InlineQueryError } from "@/core/ui/inline-query-error";
import { IconDisc } from "@/core/ui/icon-disc";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import { SectionHeader } from "@/core/ui/section-header";
import { RADIUS, SPACING } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { GoalProgressTrack } from "@/features/savings-goals/components/goal-progress-track";
import { GoalWithdrawalRow } from "@/features/savings-goals/components/goal-withdrawal-row";
import {
  goalKeys,
  useSavingsGoal,
  useSavingsGoalProgress,
  useSavingsGoalWithdrawals,
} from "@/features/savings-goals/goals-queries";
import { goalHistory } from "@/features/savings-goals/goal-presentation";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

/**
 * « Historique » of a goal — `GoalHistoryView.swift`: the account that explains
 * the saved figure (départ + versé − retiré = mis de côté), then what moved
 * month by month, newest first.
 */
export default function GoalHistoryScreen() {
  useAmountMasking();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const financial = useFinancialColors();
  const queryClient = useQueryClient();
  const { locale, t } = useTranslation();
  const settings = useUserSettings();
  const goal = useSavingsGoal(id);
  const progress = useSavingsGoalProgress(id);
  const withdrawals = useSavingsGoalWithdrawals(id);
  const pull = usePullToRefresh(() =>
    queryClient.invalidateQueries({ queryKey: goalKeys.all }),
  );

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const history = useMemo(
    () =>
      progress.data === undefined
        ? null
        : goalHistory(
            progress.data,
            withdrawals.data?.data ?? [],
            settings.data?.payDayOfMonth ?? null,
          ),
    [progress.data, withdrawals.data, settings.data?.payDayOfMonth],
  );

  const bar = (
    <ScreenAppBar>
      <Appbar.BackAction
        onPress={() => router.back()}
        accessibilityLabel={t("common.back")}
      />
      <Appbar.Content
        title={t("goals.history.title")}
        subtitle={goal.data?.name}
      />
    </ScreenAppBar>
  );

  if (history === null) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {bar}
        {progress.isError ? (
          <PlaceholderScreen
            icon="cloud-off-outline"
            title={t("goals.detail.loadErrorTitle")}
            hint={t("common.loadErrorHint")}
            action={{
              label: t("common.retry"),
              onPress: () => void progress.refetch(),
            }}
          />
        ) : null}
      </View>
    );
  }

  const accountRows: { label: string; amount: string }[] = [];
  if (history.initialAmount > 0) {
    accountRows.push({
      label: t("goals.history.start"),
      amount: formatAmount(history.initialAmount, currency),
    });
  }
  accountRows.push({
    label: t("goals.history.paid", { count: history.pointedMonthCount }),
    amount: `+${formatAmount(history.contributed, currency)}`,
  });
  if (history.withdrawn > 0) {
    accountRows.push({
      label: t("goals.history.withdrawn"),
      amount: formatAmount(-history.withdrawn, currency),
    });
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      {bar}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl {...pull} />}
      >
        <View
          style={[styles.account, { backgroundColor: theme.colors.surface }]}
        >
          {accountRows.map((row) => (
            <View key={row.label} style={styles.accountLine}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {row.label}
              </Text>
              <Amount size="meta">{row.amount}</Amount>
            </View>
          ))}
          <Divider />
          <View style={styles.accountLine}>
            <Text variant="titleSmall">{t("goals.history.saved")}</Text>
            <Amount size="row">
              {formatCurrency(history.saved, currency)}
            </Amount>
          </View>
        </View>

        {withdrawals.isError && (
          <InlineQueryError
            message={t("goals.withdrawals.loadError")}
            onRetry={() => void withdrawals.refetch()}
          />
        )}

        {history.months.map((month) => (
          <View key={month.id} style={styles.group}>
            <SectionHeader
              title={formatMonthLabel(month.month, month.year, locale)}
              subtitle={
                month.endBalance === null
                  ? undefined
                  : t("goals.history.endOfMonth", {
                      amount: formatAmount(month.endBalance, currency),
                    })
              }
            />
            <LedgerCard>
              {month.contribution !== null && (
                <LedgerRow
                  leading={<IconDisc name="check" tint={financial.savings} />}
                  title={t("goals.history.contribution")}
                  subtitle={
                    <GoalProgressTrack fraction={month.contribution.fraction} />
                  }
                  trailing={
                    <Amount size="row">
                      {`+${formatCurrency(month.contribution.amount, currency)}`}
                    </Amount>
                  }
                  accessibilityLabel={t(
                    "goals.history.contributionAccessibility",
                    {
                      amount: formatCurrency(
                        month.contribution.amount,
                        currency,
                      ),
                      percent: `${month.contribution.percent} %`,
                    },
                  )}
                />
              )}
              {month.withdrawals.map((withdrawal) => (
                <GoalWithdrawalRow
                  key={withdrawal.transactionId}
                  name={withdrawal.name}
                  subtitle={`${formatInstantDay(withdrawal.transactionDate, locale)} · ${t(
                    `budgets.detail.filters.${withdrawal.checkedAt != null ? "checked" : "unchecked"}`,
                  )}`}
                  amount={withdrawal.amount}
                  currency={currency}
                  budgetId={withdrawal.budgetId}
                />
              ))}
              {month.initialAmount !== null && (
                <LedgerRow
                  title={t("goals.progress.initial")}
                  subtitle={t("goals.history.initialHint")}
                  trailing={
                    <Amount size="row">
                      {formatCurrency(month.initialAmount, currency)}
                    </Amount>
                  }
                />
              )}
            </LedgerCard>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xxl },
  account: { borderRadius: RADIUS.card, padding: SPACING.md, gap: SPACING.sm },
  accountLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  group: { gap: SPACING.sm },
});
