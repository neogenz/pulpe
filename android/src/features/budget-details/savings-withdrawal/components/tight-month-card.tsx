import { StyleSheet, View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";

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

  return (
    <Card mode="contained">
      <Card.Content style={styles.content}>
        <Text variant="titleMedium">Un mois un peu juste ?</Text>

        <View style={styles.lines}>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Tu peux couvrir ce mois avec ton épargne.
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            À remettre le mois prochain : je te le rappellerai.
          </Text>
        </View>

        <Button mode="contained" onPress={onWithdraw}>
          Couvrir ce mois avec mon épargne
        </Button>
        <Button mode="text" onPress={onDismiss}>
          Plus tard
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACING.sm },
  lines: { gap: SPACING.xxs },
});
