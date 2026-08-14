import type { SavingsGoalProgress, SavingsGoalStatus } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Button, Icon, Text, useTheme } from "react-native-paper";

import { Card } from "@/core/ui/card";
import { ICON_SIZE, SPACING } from "@/core/ui/theme";

interface GoalStateCardsProps {
  progress: SavingsGoalProgress;
  status: SavingsGoalStatus;
  futureLineCount: number;
  isMutating: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onManageFutureLines: () => void;
}

/**
 * The states a goal can drift into, and the one action each one calls for.
 *
 * The server owns every flag here; this only renders them and forwards what the
 * user chooses. Nothing flips on its own — a goal is marked achieved because
 * someone said so, never because a number crossed a line.
 */
export function GoalStateCards({
  progress,
  status,
  futureLineCount,
  isMutating,
  onEdit,
  onComplete,
  onReopen,
  onManageFutureLines,
}: GoalStateCardsProps) {
  const isActive = status === "ACTIVE";

  return (
    <>
      {isActive && progress.isOverdue && (
        <StateCard
          icon="calendar"
          title="Échéance dépassée"
          message="Ton échéance est passée. Tu peux la repousser pour continuer à ton rythme."
          actionLabel="Repousser la date"
          onPress={onEdit}
        />
      )}

      {isActive && progress.suggestCompletion === true && (
        <StateCard
          icon="check-decagram"
          title="Objectif atteint"
          message="Tu as mis de côté l'équivalent de ta cible. On le marque comme atteint ?"
          actionLabel="Marquer comme atteint"
          onPress={onComplete}
          isDisabled={isMutating}
        />
      )}

      {status === "COMPLETED" && (
        <StateCard
          icon="flag-checkered"
          title="Objectif atteint"
          message="Tu peux le ré-ouvrir si tu veux continuer à épargner dessus."
          actionLabel="Ré-ouvrir"
          onPress={onReopen}
          isDisabled={isMutating}
        />
      )}

      {!isActive && futureLineCount > 0 && (
        <StateCard
          icon="calendar-clock"
          title="Prévisions liées sur tes mois futurs"
          message={`Cet objectif est arrêté, mais ${futureLineCount} prévision(s) Épargne lui restent réservées sur les mois à venir.`}
          actionLabel="Gérer ces prévisions"
          onPress={onManageFutureLines}
        />
      )}
    </>
  );
}

function StateCard({
  icon,
  title,
  message,
  actionLabel,
  onPress,
  isDisabled = false,
}: {
  icon: string;
  title: string;
  message: string;
  actionLabel: string;
  onPress: () => void;
  isDisabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Card mode="contained">
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <Icon
            source={icon}
            size={ICON_SIZE.lg}
            color={theme.colors.primary}
          />
          <View style={styles.labels}>
            <Text variant="titleSmall">{title}</Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {message}
            </Text>
          </View>
        </View>
        <Button mode="outlined" onPress={onPress} disabled={isDisabled}>
          {actionLabel}
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACING.md },
  header: { flexDirection: "row", gap: SPACING.md },
  labels: { flex: 1, gap: SPACING.xxs },
});
