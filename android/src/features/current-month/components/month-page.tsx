import { router } from "expo-router";
import {
  type BudgetPeriodDates,
  getBudgetPeriodDates,
  type SupportedCurrency,
} from "pulpe-shared";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { ActivityIndicator, Appbar, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "@/core/i18n/locale-store";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import type { BudgetDetails } from "@/features/budgets/budget-api";

import { useCurrentMonth } from "../current-month-queries";
import type { CurrentMonthViewModel } from "../current-month-view-model";

export interface LoadedMonth {
  budgetId: string;
  details: BudgetDetails;
  viewModel: CurrentMonthViewModel;
  currency: SupportedCurrency;
  period: BudgetPeriodDates;
  refresh: () => Promise<void>;
}

interface MonthPageProps {
  title: string;
  children: (month: LoadedMonth) => ReactNode;
}

/**
 * The frame of the pages pushed from the home: an app bar with its way back,
 * and the current month once it has loaded — the same cached queries the home
 * reads, so opening a page costs nothing extra.
 */
export function MonthPage({ title, children }: MonthPageProps) {
  // Repaints the page when amounts are hidden or shown.
  useAmountMasking();
  const theme = useTheme();
  const { t } = useTranslation();
  const month = useCurrentMonth();
  const { budgetId, details, viewModel } = month;

  const bar = (
    <ScreenAppBar>
      <Appbar.BackAction
        onPress={() => router.back()}
        accessibilityLabel={t("common.back")}
      />
      <Appbar.Content title={title} />
    </ScreenAppBar>
  );

  if (
    month.status !== "ready" ||
    budgetId === null ||
    details === null ||
    viewModel === null
  ) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {bar}
        {month.status === "failed" ? (
          <PlaceholderScreen
            icon="cloud-off-outline"
            title={t("home.states.loadErrorTitle")}
            hint={t("home.states.loadErrorHint")}
            action={{
              label: t("common.retry"),
              onPress: () => void month.refresh(),
            }}
          />
        ) : (
          <ActivityIndicator
            style={styles.loading}
            accessibilityLabel={t("common.loading")}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      {bar}
      {children({
        budgetId,
        details,
        viewModel,
        currency: month.currency,
        period: getBudgetPeriodDates(
          details.budget.month,
          details.budget.year,
          month.payDayOfMonth,
        ),
        refresh: month.refresh,
      })}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1 },
});
