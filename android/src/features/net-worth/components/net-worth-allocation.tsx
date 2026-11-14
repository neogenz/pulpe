import type { SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { useFinancialColors, useV2Colors } from "@/core/ui/scheme-colors";
import { RADIUS, SPACING } from "@/core/ui/theme";

import type { AllocationShare } from "../net-worth-sections";

const BAR_HEIGHT = 12;

/** « Répartition aujourd'hui »: what I have, split by Type in one segmented bar. */
export function NetWorthAllocation({
  shares,
  baseCurrency,
}: {
  shares: AllocationShare[];
  baseCurrency: SupportedCurrency;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const financial = useFinancialColors();
  const v2 = useV2Colors();
  // One ink per Type, cycled: opacity steps would break the contrast contract.
  const inks = [
    theme.colors.primary,
    financial.savings,
    financial.income,
    financial.expense,
    v2.coral,
    v2.ink3,
  ];
  const inkAt = (index: number) => inks[index % inks.length];
  if (shares.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.titles}>
        <Text variant="titleSmall">{t("netWorth.allocation.title")}</Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("netWorth.allocation.subtitle")}
        </Text>
      </View>
      <View style={styles.bar} accessibilityElementsHidden>
        {shares.map((entry, index) => (
          <View
            key={entry.id}
            style={{
              flex: entry.share,
              backgroundColor: inkAt(index),
            }}
          />
        ))}
      </View>
      {shares.map((entry, index) => (
        <View
          key={entry.id}
          style={styles.legendRow}
          accessible
          accessibilityLabel={`${entry.name}, ${formatCurrency(entry.total, baseCurrency)}, ${Math.round(entry.share * 100)} %`}
        >
          <View
            style={[
              styles.dot,
              {
                backgroundColor: inkAt(index),
              },
            ]}
          />
          <Text variant="bodyMedium" style={styles.name}>
            {entry.name}
          </Text>
          <Amount size="meta">
            {formatCurrency(entry.total, baseCurrency)}
          </Amount>
          <Text
            variant="bodySmall"
            style={[styles.percent, { color: theme.colors.onSurfaceVariant }]}
          >
            {Math.round(entry.share * 100)} %
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACING.md, gap: SPACING.sm, borderRadius: RADIUS.card },
  titles: { gap: SPACING.xxs },
  bar: {
    flexDirection: "row",
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: "hidden",
    gap: 2,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1 },
  percent: { width: 56, textAlign: "right", fontVariant: ["tabular-nums"] },
});
