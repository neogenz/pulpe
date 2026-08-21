import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { Card } from "@/core/ui/card";
import { useTranslation } from "@/core/i18n/locale-store";
import { SPACING } from "@/core/ui/theme";

interface TightMonthCardProps {
  onWithdraw: () => void;
  onDismiss: () => void;
}

/**
 * What a month in deficit is offered instead of a red number and nothing to do
 * about it.
 *
 * The wording is contractual — it was tested with users, and it says what the
 * two lines actually are. Never "avance", never "emprunt": nobody is lending
 * anything, the money is the user's own and it goes back next month.
 */
export function TightMonthCard({ onWithdraw, onDismiss }: TightMonthCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Card mode="contained">
      <Card.Content style={styles.content}>
        <Text variant="titleMedium">
          {t("budgets.actions.withdrawal.cardTitle")}
        </Text>

        <View style={styles.lines}>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("budgets.actions.withdrawal.cardMessage")}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("budgets.actions.withdrawal.cardReminder")}
          </Text>
        </View>

        <Button mode="contained" onPress={onWithdraw}>
          {t("budgets.actions.withdrawal.cardAction")}
        </Button>
        <Button mode="text" onPress={onDismiss}>
          {t("budgets.actions.withdrawal.later")}
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACING.sm },
  lines: { gap: SPACING.xxs },
});
