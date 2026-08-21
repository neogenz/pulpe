import type { SupportedCurrency, Transaction } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";

import { useTags } from "@/features/tags/tag-queries";
import { tagSummary } from "@/features/tags/tag-selection";
import {
  formatCompactCurrency,
  formatSignedCompactCurrency,
} from "@/core/ui/amount-format";
import { IconDisc } from "@/core/ui/icon-disc";
import { Amount } from "@/core/ui/amount";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { FilterChip } from "@/core/ui/filter-chip";
import { FINANCIAL_COLORS, RADIUS, SPACING } from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";
import { formatRelativeDay } from "@/core/ui/date-format";

import { summarizeActivity, type ActivityWindow } from "../activity-window";

const WINDOWS: ActivityWindow[] = ["week", "month"];

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
  const { locale, t } = useTranslation();
  const [window, setWindow] = useState<ActivityWindow>("week");
  const now = new Date();
  const { days, net } = summarizeActivity(transactions, window, now);
  // Names live on their own endpoint — a transaction carries ids only.
  const tags = useTags();

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text variant="titleSmall">{t("home.activity.title")}</Text>
        <Amount size="meta">
          {formatSignedCompactCurrency(net, currency)}
        </Amount>
      </View>

      <View style={styles.windows}>
        {WINDOWS.map((option) => (
          <FilterChip
            key={option}
            selected={window === option}
            onPress={() => setWindow(option)}
            accessibilityLabel={t("home.activity.windowAccessibility", {
              window: t(`home.activity.window.${option}`),
            })}
          >
            {t(`home.activity.window.${option}`)}
          </FilterChip>
        ))}
        {onPressAll !== undefined && (
          <Button mode="text" compact onPress={onPressAll}>
            {t("home.activity.viewAll")}
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
            <IconDisc name="tray" tint={theme.colors.onSurfaceVariant} />
            <View style={styles.labels}>
              <Text variant="bodyLarge">
                {t(`home.activity.empty.${window}`)}
              </Text>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("home.activity.emptyHint")}
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
              {formatRelativeDay(day.date, now, locale)}
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
                      <IconDisc
                        name={KIND_ICONS[transaction.kind]}
                        tint={accent}
                      />
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
  labels: { flex: 1, gap: SPACING.xxs },
});
