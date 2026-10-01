import type { SupportedCurrency, Transaction } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SegmentedButtons, Text, useTheme } from "react-native-paper";

import { useTags } from "@/features/tags/tag-queries";
import { tagSummary } from "@/features/tags/tag-selection";
import {
  formatCompactCurrency,
  formatSignedCompactCurrency,
} from "@/core/ui/amount-format";
import { IconDisc } from "@/core/ui/icon-disc";
import { Amount } from "@/core/ui/amount";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { SectionHeader } from "@/core/ui/section-header";
import { useFinancialColors } from "@/core/ui/scheme-colors";
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
 * the month is read: the last week, or the whole of it. Each day is named once,
 * on the canvas, above the card that carries its operations — `ActivityCard`
 * on iOS.
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
      <SectionHeader
        title={t("home.activity.title")}
        subtitle={formatSignedCompactCurrency(net, currency)}
        link={
          onPressAll === undefined
            ? undefined
            : { label: t("home.activity.viewAll"), onPress: onPressAll }
        }
      />

      <SegmentedButtons
        value={window}
        onValueChange={(value) => setWindow(value as ActivityWindow)}
        buttons={WINDOWS.map((option) => ({
          value: option,
          label: t(`home.activity.window.${option}`),
          accessibilityLabel: t("home.activity.windowAccessibility", {
            window: t(`home.activity.window.${option}`),
          }),
        }))}
      />

      {days.length === 0 ? (
        <LedgerCard>
          <LedgerRow
            leading={
              <IconDisc name="tray" tint={theme.colors.onSurfaceVariant} />
            }
            title={t(`home.activity.empty.${window}`)}
            subtitle={t("home.activity.emptyHint")}
          />
        </LedgerCard>
      ) : (
        days.map((day) => (
          <View key={day.date.toISOString()} style={styles.day}>
            <Text
              variant="labelLarge"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {formatRelativeDay(day.date, now, locale)}
            </Text>
            <LedgerCard>
              {day.transactions.map((transaction) => (
                <LedgerRow
                  key={transaction.id}
                  leading={
                    <IconDisc
                      name={KIND_ICONS[transaction.kind]}
                      tint={financial[KIND_ACCENTS[transaction.kind]]}
                    />
                  }
                  title={transaction.name}
                  subtitle={
                    tagSummary(transaction.tagIds, tags.data ?? []) ?? undefined
                  }
                  trailing={
                    <Amount size="row" numberOfLines={1}>
                      {formatCompactCurrency(transaction.amount, currency)}
                    </Amount>
                  }
                />
              ))}
            </LedgerCard>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm + SPACING.xs },
  day: { gap: SPACING.sm },
});
