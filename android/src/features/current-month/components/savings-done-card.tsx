import type { SupportedCurrency } from "pulpe-shared";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { formatCompactCurrency } from "@/core/ui/amount-format";
import {
  FINANCIAL_COLORS,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";

const ICON_SIZE = 20;
const ICON_DIAMETER = 36;
const ICON_TINT_OPACITY = "26";

interface SavingsDoneCardProps {
  amount: number;
  currency: SupportedCurrency;
  onPress: () => void;
}

/**
 * Takes the drift card's place when nothing drifted and the month's transfers
 * are all made. It carries no heading of its own: "tout va bien" is the whole
 * message, and a section title above one row announces a list that is not there.
 */
export function SavingsDoneCard({
  amount,
  currency,
  onPress,
}: SavingsDoneCardProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const savingsColor = FINANCIAL_COLORS[scheme].savings;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Épargne du mois versée, ${formatCompactCurrency(amount, currency)}`}
      accessibilityHint="Voir mes objectifs d'épargne"
      style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
    >
      <View
        style={[
          styles.icon,
          { backgroundColor: `${savingsColor}${ICON_TINT_OPACITY}` },
        ]}
      >
        <MaterialCommunityIcons
          name="check"
          size={ICON_SIZE}
          color={savingsColor}
        />
      </View>

      <View style={styles.text}>
        <Text variant="bodyLarge">Épargne du mois versée</Text>
        <Text
          variant="labelMedium"
          style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
        >
          {formatCompactCurrency(amount, currency)}
        </Text>
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={ICON_SIZE}
        color={theme.colors.onSurfaceVariant}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  icon: {
    width: ICON_DIAMETER,
    height: ICON_DIAMETER,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: SPACING.xxs },
});
