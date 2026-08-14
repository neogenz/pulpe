import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { SupportedCurrency, Transaction } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";

import { useTags } from "@/core/tags/tag-queries";
import { tagSummary } from "@/core/tags/tag-selection";
import {
  formatCompactCurrency,
  formatSignedCompactCurrency,
} from "@/core/ui/amount-format";
import { Amount } from "@/core/ui/amount";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { FilterChip } from "@/core/ui/filter-chip";
import { FINANCIAL_COLORS, ICON_SIZE, RADIUS, SPACING } from "@/core/ui/theme";

import { summarizeActivity, type ActivityWindow } from "../activity-window";

const ICON_DIAMETER = 36;
const ICON_TINT_OPACITY = "26";

const WINDOWS: { value: ActivityWindow; label: string }[] = [
  { value: "week", label: "7 jours" },
  { value: "month", label: "Ce mois" },
];

const EMPTY_TITLES: Record<ActivityWindow, string> = {
  week: "Rien sur ces 7 jours",
  month: "Rien ce mois-ci",
};

const KIND_ICONS = {
  income: "arrow-down",
  expense: "arrow-up",
  saving: "piggy-bank-outline",
} as const satisfies Record<Transaction["kind"], string>;

const KIND_ACCENTS = {
  income: "income",
  expense: "expense",
  saving: "savings",
} as const satisfies Record<
  Transaction["kind"],
  keyof typeof FINANCIAL_COLORS.light
>;

interface ActivityCardProps {
  transactions: Transaction[];
  currency: SupportedCurrency;
  /** Absent until the month has a budget to open. */
  onPressAll?: () => void;
}

/**
 * What actually happened, newest first, under the one selector that maps to how
 * the month is read: the last week, or the whole of it.
 */
export function ActivityCard({
  transactions,
  currency,
  onPressAll,
}: ActivityCardProps) {
  const theme = useTheme();
  const financial = useFinancialColors();
  const [window, setWindow] = useState<ActivityWindow>("week");
  const { days, net } = summarizeActivity(transactions, window, new Date());
  // Names live on their own endpoint — a transaction carries ids only.
  const tags = useTags();

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text variant="titleSmall">Activité</Text>
        <Amount size="meta">
          {formatSignedCompactCurrency(net, currency)}
        </Amount>
      </View>

      <View style={styles.windows}>
        {WINDOWS.map((option) => (
          <FilterChip
            key={option.value}
            selected={window === option.value}
            onPress={() => setWindow(option.value)}
            accessibilityLabel={`Activité sur ${option.label}`}
          >
            {option.label}
          </FilterChip>
        ))}
        {onPressAll !== undefined && (
          <Button mode="text" compact onPress={onPressAll}>
            Tout voir
          </Button>
        )}
      </View>

      {days.length === 0 ? (
        <View
          style={[
            styles.rows,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <View style={styles.row}>
            <View
              style={[
                styles.icon,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            >
              <MaterialCommunityIcons
                name="tray"
                size={ICON_SIZE.md}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
            <View style={styles.labels}>
              <Text variant="bodyLarge">{EMPTY_TITLES[window]}</Text>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Tes opérations s&apos;afficheront ici
              </Text>
            </View>
          </View>
        </View>
      ) : (
        days.map((day) => (
          <View key={day.date.toISOString()} style={styles.day}>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {day.label}
            </Text>
            <View
              style={[
                styles.rows,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              {day.transactions.map((transaction, index) => {
                const accent = financial[KIND_ACCENTS[transaction.kind]];
                const tagged = tagSummary(transaction.tagIds, tags.data ?? []);
                return (
                  <View key={transaction.id}>
                    {index > 0 && <Divider />}
                    <View style={styles.row}>
                      <View
                        style={[
                          styles.icon,
                          { backgroundColor: `${accent}${ICON_TINT_OPACITY}` },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={KIND_ICONS[transaction.kind]}
                          size={ICON_SIZE.md}
                          color={accent}
                        />
                      </View>
                      <View style={styles.labels}>
                        <Text variant="bodyLarge" numberOfLines={1}>
                          {transaction.name}
                        </Text>
                        {tagged !== null && (
                          <Text
                            variant="labelSmall"
                            numberOfLines={1}
                            style={{ color: theme.colors.onSurfaceVariant }}
                          >
                            {tagged}
                          </Text>
                        )}
                      </View>
                      <Amount size="row" numberOfLines={1}>
                        {formatCompactCurrency(transaction.amount, currency)}
                      </Amount>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.sm },
  heading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  windows: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  day: { gap: SPACING.xs },
  rows: { borderRadius: RADIUS.card, paddingHorizontal: SPACING.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  icon: {
    width: ICON_DIAMETER,
    height: ICON_DIAMETER,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  labels: { flex: 1, gap: SPACING.xxs },
});
