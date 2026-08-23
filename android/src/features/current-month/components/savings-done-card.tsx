import type { SupportedCurrency } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { IconDisc } from "@/core/ui/icon-disc";
import { Amount } from "@/core/ui/amount";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { useRipple } from "@/core/ui/ripple";
import { ICON_SIZE, RADIUS, SPACING } from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";

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
  const ripple = useRipple();
  const financial = useFinancialColors();
  const { t } = useTranslation();
  const savingsColor = financial.savings;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={ripple}
      accessibilityRole="button"
      accessibilityLabel={t("home.savingsDone.accessibility", {
        amount: formatCompactCurrency(amount, currency),
      })}
      accessibilityHint={t("home.savingsDone.hint")}
      style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
    >
      <IconDisc name="check" tint={savingsColor} />

      <View style={styles.text}>
        <Text variant="bodyLarge">{t("home.savingsDone.title")}</Text>
        <Amount size="meta" tone="muted">
          {formatCompactCurrency(amount, currency)}
        </Amount>
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={ICON_SIZE.md}
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
  text: { flex: 1, gap: SPACING.xxs },
});
