import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  FAB,
  IconButton,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  consumeAddExpenseRequest,
  useDeepLinkStore,
} from "@/core/linking/deep-links";
import { useReminderPriming } from "@/core/notifications/use-reminder-priming";
import { dismissTip } from "@/core/tips/tips-store";
import { Tooltip } from "@/core/tips/tooltip";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatMonthName } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { FAB_CLEARANCE, SPACING } from "@/core/ui/theme";
import { useBudgetList } from "@/features/budgets/budget-queries";
import { hasAvailableMonth } from "@/features/budgets/available-months";
import { ActivityCard } from "@/features/current-month/components/activity-card";
import { TransactionSheet } from "@/features/transactions/components/transaction-sheet";
import { DriftCard } from "@/features/current-month/components/drift-card";
import { HomeHeroCard } from "@/features/current-month/components/home-hero-card";
import { NotificationPrimeSheet } from "@/features/current-month/components/notification-prime-sheet";
import { RealizedBalanceSheet } from "@/features/current-month/components/realized-balance-sheet";
import { SavingsDoneCard } from "@/features/current-month/components/savings-done-card";
import { UncheckedOperationsCard } from "@/features/current-month/components/unchecked-operations-card";
import { useCurrentMonth } from "@/features/current-month/current-month-queries";
import type { CheckableItem } from "@/features/current-month/current-month-view-model";
import { heroPresentation } from "@/features/current-month/home-hero-presentation";
import { useToggleCheck } from "@/features/budgets/toggle-check-mutation";

export default function HomeScreen() {
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const theme = useTheme();
  const currentMonth = useCurrentMonth();
  const [isRealizedVisible, setRealizedVisible] = useState(false);
  const [isAddOpen, setAddOpen] = useState(false);
  // `pulpe://add-expense` lands here rather than on a route of its own: the
  // sheet is the add-expense surface, and it belongs to this screen.
  const isAddRequested = useDeepLinkStore(
    (state) => state.isAddExpenseRequested,
  );
  const isAddVisible = isAddOpen || isAddRequested;
  // Names the step that failed: a pointing that never reached the server and an
  // undo that did not go back are two different pieces of news.
  const [toggleFailure, setToggleFailure] = useState<string | null>(null);
  const [pointed, setPointed] = useState<CheckableItem | null>(null);
  const [hasTransactionAdded, setTransactionAdded] = useState(false);
  // A rolled-back row reappearing is not an explanation, so the failure is said
  // out loud — and so is the success, because the row leaves the card either
  // way and the way back has to be offered while it is still obvious.
  const toggle = useToggleCheck(currentMonth.budgetId);
  const reminders = useReminderPriming();
  // Same cached query the current month resolves against, so this costs nothing
  // extra — it only asks a different question of it.
  const budgets = useBudgetList();
  const hasMonthToPrepare =
    budgets.data !== undefined && hasAvailableMonth(budgets.data, new Date());

  if (currentMonth.status === "loading") {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (currentMonth.status === "failed") {
    return (
      <PlaceholderScreen
        title="On n'a pas pu charger ton mois"
        hint="Réessaie — si ça persiste, vérifie ta connexion."
        action={{
          label: "Réessayer",
          onPress: () => void currentMonth.refresh(),
        }}
      />
    );
  }

  if (currentMonth.status === "empty" || currentMonth.viewModel === null) {
    return (
      <PlaceholderScreen
        title="Pas encore de budget ce mois-ci"
        hint="Crée-le pour voir ton tableau de bord."
        action={{
          label: "Créer mon budget",
          onPress: () => router.push("/budget/create"),
        }}
      />
    );
  }

  const { viewModel, currency } = currentMonth;
  // One verdict for the whole screen: the hero states it, the drift card reads
  // it to say whether the overrun was covered elsewhere.
  const presentation = heroPresentation({
    estimatedBalance: viewModel.metrics.remaining,
    fallbackPlannedBalance: viewModel.metrics.endingBalance,
    trajectory: viewModel.trajectory,
  });
  // Closing has to answer both openers, or a deep-linked sheet reopens itself.
  function closeAdd() {
    setAddOpen(false);
    consumeAddExpenseRequest();
  }

  const monthName = formatMonthName(
    currentMonth.details?.budget.month ?? new Date().getMonth() + 1,
    currentMonth.details?.budget.year ?? new Date().getFullYear(),
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={currentMonth.isRefreshing}
            onRefresh={() => void currentMonth.refresh()}
          />
        }
      >
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            {monthName}
          </Text>
          <IconButton
            icon="account-circle-outline"
            onPress={() => router.push("/settings")}
            accessibilityLabel="Mon compte"
          />
        </View>

        <HomeHeroCard
          presentation={presentation}
          trajectory={viewModel.trajectory}
          monthName={monthName}
          uncheckedCount={viewModel.uncheckedCount}
          currency={currency}
          onPressMetrics={() => setRealizedVisible(true)}
          onPressDetail={
            currentMonth.budgetId === null
              ? undefined
              : () => router.push(`/budget/${currentMonth.budgetId}`)
          }
        />

        {viewModel.driftLines.length > 0 ? (
          <DriftCard
            drifts={viewModel.driftLines}
            totalOver={viewModel.driftTotal}
            absorbsOverrun={presentation.absorbsEnvelopeOverrun}
            currency={currency}
          />
        ) : (
          viewModel.savings.isComplete && (
            <SavingsDoneCard
              amount={viewModel.savings.totalRealized}
              currency={currency}
              onPress={() => router.push("/goals")}
            />
          )
        )}

        {viewModel.uncheckedItems.length > 0 && (
          <>
            <Tooltip
              id="checking"
              icon="check-circle-outline"
              title="Pointage"
              message="Quand un mouvement est passé sur ton compte, pointe-le ici pour garder le fil."
            />
            <UncheckedOperationsCard
              items={viewModel.uncheckedItems}
              currency={currency}
              isSyncing={toggle.isPending}
              onToggle={(item) => {
                // Doing it explains it better than the card ever could.
                dismissTip("checking");
                toggle.mutate(item, {
                  onError: () =>
                    setToggleFailure(
                      "Le pointage n'a pas été enregistré. Réessaie.",
                    ),
                  // Offered here and nowhere else: a reminder to point is worth
                  // something only to someone who has just found out what
                  // pointing does.
                  onSuccess: () => {
                    setPointed(item);
                    reminders.offer();
                  },
                });
              }}
            />
          </>
        )}

        <ActivityCard
          transactions={currentMonth.details?.transactions ?? []}
          currency={currency}
          onPressAll={
            currentMonth.budgetId === null
              ? undefined
              : () => router.push(`/budget/${currentMonth.budgetId}`)
          }
        />

        <View style={styles.dailyBudget}>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {viewModel.daysRemaining === 1
              ? "Dernier jour de la période"
              : `${viewModel.daysRemaining} jours avant la prochaine paie`}
          </Text>
        </View>

        {hasMonthToPrepare && (
          <Button
            mode="outlined"
            icon="calendar-plus"
            onPress={() => router.push("/budget/create")}
          >
            Préparer le mois suivant
          </Button>
        )}
      </ScrollView>

      {/* Hidden while a sheet is up: the FAB floats above the Portal's scrim
          and would otherwise sit on top of the form it just opened. */}
      {!isAddVisible && !isRealizedVisible && !reminders.isVisible && (
        <FAB
          icon="plus"
          label="Ajouter"
          style={styles.fab}
          onPress={() => setAddOpen(true)}
          accessibilityLabel="Ajouter une opération"
        />
      )}

      {/* The server flips whatever state it holds, so taking the pointing back
          is the very same call a second time. */}
      <Snackbar
        visible={pointed !== null}
        onDismiss={() => setPointed(null)}
        action={{
          label: "Annuler",
          onPress: () => {
            const item = pointed;
            setPointed(null);
            if (item === null) return;
            toggle.mutate(item, {
              onError: () =>
                setToggleFailure(
                  "Le pointage n'a pas pu être annulé. Reprends-le depuis le budget.",
                ),
            });
          },
        }}
      >
        {pointed === null ? "" : `${pointed.name} pointé`}
      </Snackbar>

      <Snackbar
        visible={toggleFailure !== null}
        onDismiss={() => setToggleFailure(null)}
        action={{ label: "Fermer", onPress: () => setToggleFailure(null) }}
      >
        {toggleFailure}
      </Snackbar>

      <Snackbar
        visible={hasTransactionAdded}
        onDismiss={() => setTransactionAdded(false)}
      >
        Opération ajoutée
      </Snackbar>

      <RealizedBalanceSheet
        isVisible={isRealizedVisible}
        onDismiss={() => setRealizedVisible(false)}
        metrics={viewModel.metrics}
        realized={viewModel.realized}
        currency={currency}
      />

      <NotificationPrimeSheet
        isVisible={reminders.isVisible}
        onDismiss={reminders.dismiss}
        onEnable={reminders.enable}
      />

      {currentMonth.budgetId !== null && (
        <TransactionSheet
          isVisible={isAddVisible}
          onDismiss={closeAdd}
          budgetId={currentMonth.budgetId}
          currency={currency}
          onSaved={() => {
            closeAdd();
            setTransactionAdded(true);
          }}
        />
      )}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { textTransform: "capitalize" },
  dailyBudget: { paddingHorizontal: SPACING.xs },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
