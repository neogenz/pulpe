import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSessionStore } from "@/core/auth/session-store";
import { formatMonthName } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { SPACING } from "@/core/ui/theme";
import { DriftCard } from "@/features/current-month/components/drift-card";
import { HomeHeroCard } from "@/features/current-month/components/home-hero-card";
import { RealizedBalanceSheet } from "@/features/current-month/components/realized-balance-sheet";
import { SavingsDoneCard } from "@/features/current-month/components/savings-done-card";
import { UncheckedOperationsCard } from "@/features/current-month/components/unchecked-operations-card";
import { useCurrentMonth } from "@/features/current-month/current-month-queries";
import { heroPresentation } from "@/features/current-month/home-hero-presentation";
import { useToggleCheck } from "@/features/current-month/toggle-check-mutation";

export default function HomeScreen() {
  const theme = useTheme();
  const currentMonth = useCurrentMonth();
  const signOut = useSessionStore((state) => state.signOut);
  const [isRealizedVisible, setRealizedVisible] = useState(false);
  const [hasToggleFailed, setToggleFailed] = useState(false);
  // A rolled-back row reappearing is not an explanation, so the failure is said
  // out loud. The success needs no toast: the row leaving the card is the reply.
  const toggle = useToggleCheck(currentMonth.budgetId);

  if (currentMonth.status === "loading") {
    return (
      <SafeAreaView
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
        hint="Vérifie ta connexion, puis réessaie."
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
  const monthName = formatMonthName(
    currentMonth.details?.budget.month ?? new Date().getMonth() + 1,
    currentMonth.details?.budget.year ?? new Date().getFullYear(),
  );

  return (
    <SafeAreaView
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
        <Text variant="headlineSmall" style={styles.title}>
          {monthName}
        </Text>

        <HomeHeroCard
          presentation={presentation}
          trajectory={viewModel.trajectory}
          monthName={monthName}
          uncheckedCount={viewModel.uncheckedCount}
          currency={currency}
          onPressMetrics={() => setRealizedVisible(true)}
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
          <UncheckedOperationsCard
            items={viewModel.uncheckedItems}
            currency={currency}
            isSyncing={toggle.isPending}
            onToggle={(item) =>
              toggle.mutate(item, { onError: () => setToggleFailed(true) })
            }
          />
        )}

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

        {/* Stands in for the account sheet the toolbar will carry, so the app
            still has a way out while the rest of the dashboard is built. */}
        <Button mode="text" onPress={() => void signOut()}>
          Se déconnecter
        </Button>
      </ScrollView>

      <Snackbar
        visible={hasToggleFailed}
        onDismiss={() => setToggleFailed(false)}
        action={{ label: "Fermer", onPress: () => setToggleFailed(false) }}
      >
        Le pointage n&apos;a pas été enregistré. Réessaie.
      </Snackbar>

      <RealizedBalanceSheet
        isVisible={isRealizedVisible}
        onDismiss={() => setRealizedVisible(false)}
        metrics={viewModel.metrics}
        realized={viewModel.realized}
        currency={currency}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.md, gap: SPACING.md },
  title: { textTransform: "capitalize" },
  dailyBudget: { paddingHorizontal: SPACING.xs },
});
