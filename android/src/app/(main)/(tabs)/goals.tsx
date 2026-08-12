import { router } from "expo-router";
import type {
  SavingsGoal,
  SavingsGoalStatus,
  SupportedCurrency,
} from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Card,
  Chip,
  FAB,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { formatIsoDate } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { FAB_CLEARANCE, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { GoalFormSheet } from "@/features/savings-goals/components/goal-form-sheet";
import { GoalsIntro } from "@/features/savings-goals/components/goals-intro";
import {
  hasSeenGoalsIntro,
  markGoalsIntroSeen,
} from "@/features/savings-goals/goals-intro-gate";
import { useSavingsGoals } from "@/features/savings-goals/goals-queries";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

const STATUS_LABELS: Record<SavingsGoalStatus, string> = {
  ACTIVE: "En cours",
  PAUSED: "En pause",
  COMPLETED: "Atteint",
};

export default function GoalsScreen() {
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const theme = useTheme();
  const settings = useUserSettings();
  const goals = useSavingsGoals();
  // Read once, at mount: the flag is written the moment the intro is answered,
  // and re-reading it mid-render would make the intro vanish under the user.
  const [isIntroVisible, setIntroVisible] = useState(
    () => !hasSeenGoalsIntro(),
  );
  const [isCreating, setCreating] = useState(false);

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;

  if (isIntroVisible) {
    return (
      <GoalsIntro
        currency={currency}
        onComplete={(shouldCreate) => {
          markGoalsIntroSeen();
          setIntroVisible(false);
          setCreating(shouldCreate);
        }}
      />
    );
  }

  if (goals.isPending || settings.isPending) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (goals.isError) {
    return (
      <PlaceholderScreen
        title="On n'a pas pu charger tes objectifs"
        hint="Vérifie ta connexion, puis réessaie."
        action={{ label: "Réessayer", onPress: () => void goals.refetch() }}
      />
    );
  }

  const list = goals.data ?? [];

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      {list.length === 0 ? (
        <PlaceholderScreen
          title="Fixe ton premier objectif"
          hint="Suis tes projets d'épargne long terme, sans recalculer à la main."
          action={{
            label: "Créer un objectif",
            onPress: () => setCreating(true),
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={goals.isRefetching}
              onRefresh={() => void goals.refetch()}
            />
          }
        >
          <Text variant="headlineSmall">Objectifs d&apos;épargne</Text>

          {list.map((goal) => (
            <GoalRow key={goal.id} goal={goal} currency={currency} />
          ))}
        </ScrollView>
      )}

      {list.length > 0 && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => setCreating(true)}
          accessibilityLabel="Ajouter un objectif"
        />
      )}

      <GoalFormSheet
        isVisible={isCreating}
        onDismiss={() => setCreating(false)}
        currency={currency}
        payDayOfMonth={payDayOfMonth}
        onSaved={() => setCreating(false)}
      />
    </SafeAreaView>
  );
}

function GoalRow({
  goal,
  currency,
}: {
  goal: SavingsGoal;
  currency: SupportedCurrency;
}) {
  const theme = useTheme();
  const period = periodLabel(goal);

  return (
    <Card mode="contained" onPress={() => router.push(`/goal/${goal.id}`)}>
      <Card.Content style={styles.row}>
        <View style={styles.rowLabels}>
          <Text variant="titleMedium">{goal.name}</Text>
          <View style={styles.statusLine}>
            <Chip compact>{STATUS_LABELS[goal.status]}</Chip>
            {period !== null && (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {period}
              </Text>
            )}
          </View>
        </View>

        {goal.targetAmount !== null && (
          <Text variant="titleMedium" style={TABULAR_DIGITS}>
            {formatCompactCurrency(goal.targetAmount, currency)}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

function periodLabel(goal: SavingsGoal): string | null {
  if (goal.startDate !== null && goal.targetDate !== null) {
    return `${formatIsoDate(goal.startDate)} → ${formatIsoDate(goal.targetDate)}`;
  }
  if (goal.targetDate !== null)
    return `Échéance ${formatIsoDate(goal.targetDate)}`;
  if (goal.startDate !== null) return `Depuis ${formatIsoDate(goal.startDate)}`;
  return null;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
    paddingBottom: FAB_CLEARANCE,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  rowLabels: { flex: 1, gap: SPACING.sm },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
