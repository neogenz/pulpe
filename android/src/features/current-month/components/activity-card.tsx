import type { SupportedCurrency, Transaction } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Divider, List, useTheme } from "react-native-paper";

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
import { FINANCIAL_COLORS, SPACING } from "@/core/ui/theme";
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
 * the month is read: the last week, or the whole of it. A Material list on the
 * page background — days as subheaders, one row per operation.
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
    <View style={styles.section}>
      <View style={styles.heading}>
        <List.Subheader style={styles.subheader}>
          {t("home.activity.title")}
        </List.Subheader>
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
        <List.Item
          title={t(`home.activity.empty.${window}`)}
          description={t("home.activity.emptyHint")}
          left={() => (
            <IconDisc name="tray" tint={theme.colors.onSurfaceVariant} />
          )}
          style={styles.item}
        />
      ) : (
        days.map((day) => (
          <View key={day.date.toISOString()}>
            <List.Subheader style={styles.subheader}>
              {formatRelativeDay(day.date, now, locale)}
            </List.Subheader>
            {day.transactions.map((transaction, index) => {
              const accent = financial[KIND_ACCENTS[transaction.kind]];
              const tagged = tagSummary(transaction.tagIds, tags.data ?? []);
              return (
                <View key={transaction.id}>
                  {index > 0 && <Divider />}
                  <List.Item
                    title={transaction.name}
                    titleNumberOfLines={1}
                    description={tagged ?? undefined}
                    descriptionNumberOfLines={1}
                    left={() => (
                      <IconDisc
                        name={KIND_ICONS[transaction.kind]}
                        tint={accent}
                      />
                    )}
                    right={() => (
                      <Amount size="row" numberOfLines={1}>
                        {formatCompactCurrency(transaction.amount, currency)}
                      </Amount>
                    )}
                    style={styles.item}
                  />
                </View>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.xs },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  // Paper pads its list chrome to its own gutter; the page already has one.
  subheader: { paddingHorizontal: 0, paddingVertical: 0 },
  item: { paddingHorizontal: 0 },
  windows: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
});
