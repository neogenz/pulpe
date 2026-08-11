import { router, useLocalSearchParams } from "expo-router";
import type { SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { ActivityIndicator, Appbar, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatIsoDate } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { SPACING } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { GoalFormSheet } from "@/features/savings-goals/components/goal-form-sheet";
import { GoalProgressCard } from "@/features/savings-goals/components/goal-progress-card";
import {
  useSavingsGoal,
  useSavingsGoalProgress,
} from "@/features/savings-goals/goals-queries";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

/**
 * One goal, and how far along it is. Everything the card shows is computed
 * server-side from the forecasts that fund the goal, so the screen never has to
 * know which budgets those are.
 */
export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const settings = useUserSettings();
  const goal = useSavingsGoal(id);
  const progress = useSavingsGoalProgress(id);
  const [isEditVisible, setEditVisible] = useState(false);

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;

  if (goal.isPending || progress.isPending) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (goal.data === undefined) {
    return (
      <PlaceholderScreen
        title="Cet objectif n'existe plus"
        hint="Il a peut-être été supprimé depuis un autre appareil."
        action={{ label: "Revenir", onPress: () => router.back() }}
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header mode="small" elevated={false}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={goal.data.name} />
        <Appbar.Action
          icon="pencil-outline"
          onPress={() => setEditVisible(true)}
          accessibilityLabel="Modifier l'objectif"
        />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={progress.isRefetching}
            onRefresh={() => void progress.refetch()}
          />
        }
      >
        {goal.data.targetDate !== null && (
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Échéance {formatIsoDate(goal.data.targetDate)}
          </Text>
        )}

        {progress.data !== undefined && (
          <GoalProgressCard progress={progress.data} currency={currency} />
        )}
      </ScrollView>

      <GoalFormSheet
        key={goal.data.updatedAt}
        isVisible={isEditVisible}
        onDismiss={() => setEditVisible(false)}
        currency={currency}
        payDayOfMonth={payDayOfMonth}
        goal={goal.data}
        onSaved={() => setEditVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
});
