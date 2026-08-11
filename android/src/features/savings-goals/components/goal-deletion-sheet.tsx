import * as Haptics from "expo-haptics";
import type {
  SavingsGoal,
  SavingsGoalDeletionImpact,
  SavingsGoalDeletionMode,
  SupportedCurrency,
} from "pulpe-shared";
import { useState } from "react";
import { ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Checkbox,
  Divider,
  HelperText,
  Modal,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

import { formatCompactCurrency, formatCurrency } from "@/core/ui/amount-format";
import { formatMonthLabel } from "@/core/ui/date-format";
import {
  FINANCIAL_COLORS,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";

import {
  useDeleteSavingsGoal,
  useSavingsGoalDeletionImpact,
} from "../goals-queries";

const CONFIRMATION_LABELS: Record<SavingsGoalDeletionMode, string> = {
  goal_only: "Supprimer seulement l'objectif",
  goal_and_forecasts: "Supprimer l'objectif et les prévisions",
  goal_forecasts_and_transactions: "Tout supprimer",
};

interface GoalDeletionSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  goal: SavingsGoal;
  currency: SupportedCurrency;
  onDeleted: () => void;
}

/**
 * What deleting a goal takes with it, shown before anything is written.
 *
 * A goal owns forecasts across months of budgets and the operations booked
 * against them, so the server is asked first and answers with the exact list —
 * plus a revision it then checks the deletion against. Sending that revision
 * back unchanged is what makes the confirmation binding: if anything moved in
 * between, the deletion is refused rather than applied to a different tree.
 */
export function GoalDeletionSheet({
  isVisible,
  onDismiss,
  goal,
  currency,
  onDeleted,
}: GoalDeletionSheetProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const impact = useSavingsGoalDeletionImpact(isVisible ? goal.id : null);
  const remove = useDeleteSavingsGoal();
  const [deletesForecasts, setDeletesForecasts] = useState(false);
  const [deletesTransactions, setDeletesTransactions] = useState(false);

  const mode: SavingsGoalDeletionMode = !deletesForecasts
    ? "goal_only"
    : deletesTransactions
      ? "goal_forecasts_and_transactions"
      : "goal_and_forecasts";

  function dismiss() {
    setDeletesForecasts(false);
    setDeletesTransactions(false);
    remove.reset();
    onDismiss();
  }

  function submit() {
    if (impact.data === undefined) return;
    remove.mutate(
      { goalId: goal.id, command: { mode, revision: impact.data.revision } },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          onDeleted();
        },
      },
    );
  }

  return (
    <Portal>
      <Modal
        visible={isVisible}
        onDismiss={dismiss}
        contentContainerStyle={[
          styles.sheet,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="titleMedium">Supprimer l&apos;objectif</Text>

          {impact.isPending && (
            <View style={styles.centered}>
              <ActivityIndicator accessibilityLabel="Calcul de l'impact de la suppression" />
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Calcul de l&apos;impact…
              </Text>
            </View>
          )}

          {impact.isError && (
            <>
              <Text variant="bodyMedium">
                Impossible de calculer l&apos;impact. Rien n&apos;a été
                supprimé.
              </Text>
              <Button mode="outlined" onPress={() => void impact.refetch()}>
                Réessayer
              </Button>
            </>
          )}

          {impact.data !== undefined && (
            <>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Vérifie tout ce qui est rattaché à « {goal.name} » avant de
                choisir.
              </Text>

              <ImpactSummary impact={impact.data} currency={currency} />

              <Text variant="titleSmall">Que veux-tu supprimer ?</Text>

              <Checkbox.Item
                label="Supprimer aussi toutes les prévisions rattachées"
                position="leading"
                status={deletesForecasts ? "checked" : "unchecked"}
                onPress={() =>
                  setDeletesForecasts((current) => {
                    // Transactions cannot outlive the choice that carries them.
                    if (current) setDeletesTransactions(false);
                    return !current;
                  })
                }
              />

              {deletesForecasts ? (
                <Checkbox.Item
                  label="Supprimer aussi les transactions rattachées"
                  position="leading"
                  status={deletesTransactions ? "checked" : "unchecked"}
                  onPress={() => setDeletesTransactions((current) => !current)}
                />
              ) : (
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Seul l&apos;objectif sera supprimé. Tout le reste sera
                  conservé.
                </Text>
              )}

              <ImpactDetails impact={impact.data} currency={currency} />

              {remove.isError && (
                <HelperText type="error" visible>
                  La suppression a échoué. Rien n&apos;a été supprimé.
                </HelperText>
              )}

              <Button
                mode="contained"
                buttonColor={FINANCIAL_COLORS[scheme].destructive}
                onPress={submit}
                disabled={remove.isPending}
                loading={remove.isPending}
              >
                {remove.isPending ? "Suppression…" : CONFIRMATION_LABELS[mode]}
              </Button>
            </>
          )}

          <Button mode="text" onPress={dismiss} disabled={remove.isPending}>
            Annuler
          </Button>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

function ImpactSummary({
  impact,
  currency,
}: {
  impact: SavingsGoalDeletionImpact;
  currency: SupportedCurrency;
}) {
  const { summary } = impact;

  return (
    <View
      style={styles.summary}
      accessible
      accessibilityLabel="Résumé de l'impact"
    >
      <SummaryCard
        label="Mois Type"
        count={`${summary.templateLineCount}`}
        amount={summary.templateLineTotal}
        currency={currency}
      />
      <SummaryCard
        label={`${summary.budgetLineCount} prévision(s)`}
        count={`${summary.budgetCount} budget(s)`}
        amount={summary.budgetLineTotal}
        currency={currency}
      />
      <SummaryCard
        label="Transactions"
        count={`${summary.transactionCount}`}
        amount={summary.transactionTotal}
        currency={currency}
      />
    </View>
  );
}

function SummaryCard({
  label,
  count,
  amount,
  currency,
}: {
  label: string;
  count: string;
  amount: number;
  currency: SupportedCurrency;
}) {
  const theme = useTheme();

  return (
    <Card mode="contained" style={styles.summaryCard}>
      <Card.Content style={styles.summaryContent}>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {label}
        </Text>
        <Text variant="titleMedium" style={TABULAR_DIGITS}>
          {count}
        </Text>
        <Text variant="labelMedium" style={TABULAR_DIGITS}>
          {formatCompactCurrency(amount, currency)}
        </Text>
      </Card.Content>
    </Card>
  );
}

function ImpactDetails({
  impact,
  currency,
}: {
  impact: SavingsGoalDeletionImpact;
  currency: SupportedCurrency;
}) {
  const theme = useTheme();
  const hasNothing =
    impact.templateLines.length === 0 && impact.budgets.length === 0;

  if (hasNothing && impact.withdrawals.length === 0) {
    return (
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        Aucune prévision ni transaction n&apos;est rattachée à cet objectif.
      </Text>
    );
  }

  const withdrawnTotal = impact.withdrawals.reduce(
    (total, withdrawal) => total + withdrawal.amount,
    0,
  );

  return (
    <>
      {impact.templateLines.length > 0 && (
        <View style={styles.group}>
          <Text variant="titleSmall">Prévisions du Mois Type</Text>
          <Card mode="contained">
            <Card.Content style={styles.groupCard}>
              {impact.templateLines.map((line, index) => (
                <View key={line.lineId}>
                  {index > 0 && <Divider />}
                  <ImpactRow
                    title={line.name}
                    subtitle={line.templateName}
                    amount={line.amount}
                    currency={currency}
                  />
                </View>
              ))}
            </Card.Content>
          </Card>
        </View>
      )}

      {impact.budgets.map((budget) => (
        <View key={budget.budgetId} style={styles.group}>
          <Text variant="titleSmall">
            {formatMonthLabel(budget.month, budget.year)}
          </Text>
          <Card mode="contained">
            <Card.Content style={styles.groupCard}>
              {budget.lines.map((line, index) => (
                <View key={line.lineId}>
                  {index > 0 && <Divider />}
                  <ImpactRow
                    title={line.name}
                    amount={line.amount}
                    currency={currency}
                  />
                  {line.transactions.map((transaction) => (
                    <ImpactRow
                      key={transaction.id}
                      title={transaction.name}
                      subtitle="Transaction"
                      amount={transaction.amount}
                      currency={currency}
                      isNested
                    />
                  ))}
                </View>
              ))}
            </Card.Content>
          </Card>
        </View>
      ))}

      {impact.withdrawals.length > 0 && (
        <View style={styles.group}>
          <Text variant="titleSmall">Retraits vers tes budgets</Text>
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Ces revenus restent dans leurs budgets, quel que soit ton choix.
          </Text>
          <Card mode="contained">
            <Card.Content style={styles.groupCard}>
              {impact.withdrawals.map((withdrawal, index) => (
                <View key={withdrawal.transactionId}>
                  {index > 0 && <Divider />}
                  <ImpactRow
                    title={withdrawal.name}
                    amount={withdrawal.amount}
                    currency={currency}
                  />
                </View>
              ))}
              <Divider />
              <ImpactRow
                title="Total retiré"
                amount={withdrawnTotal}
                currency={currency}
              />
            </Card.Content>
          </Card>
        </View>
      )}
    </>
  );
}

function ImpactRow({
  title,
  subtitle,
  amount,
  currency,
  isNested = false,
}: {
  title: string;
  subtitle?: string;
  amount: number;
  currency: SupportedCurrency;
  isNested?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.row, isNested && styles.nested]}>
      <View style={styles.rowLabels}>
        <Text variant={isNested ? "bodyMedium" : "bodyLarge"}>{title}</Text>
        {subtitle !== undefined && (
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <Text variant="labelLarge" style={TABULAR_DIGITS}>
        {formatCurrency(amount, currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    maxHeight: "88%",
  },
  content: { padding: SPACING.lg, gap: SPACING.md },
  centered: { alignItems: "center", gap: SPACING.sm, padding: SPACING.lg },
  summary: { flexDirection: "row", gap: SPACING.sm },
  summaryCard: { flex: 1 },
  summaryContent: { gap: SPACING.xxs },
  group: { gap: SPACING.sm },
  groupCard: { paddingVertical: SPACING.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  nested: { paddingLeft: SPACING.lg },
  rowLabels: { flex: 1, gap: SPACING.xxs },
});
