import type { SupportedCurrency, Transaction } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatRelativeDay } from "@/core/ui/date-format";
import { LedgerCard } from "@/core/ui/ledger";
import { SectionHeader } from "@/core/ui/section-header";
import { RADIUS, SPACING } from "@/core/ui/theme";
import { useV2Colors } from "@/core/ui/scheme-colors";

import { groupByDay } from "../activity-window";
import { MovementRow } from "./movement-row";

interface RecentMovementsSectionProps {
  /** Already capped to the latest few. */
  transactions: Transaction[];
  /** Whether the month has any movement at all, capped or not. */
  hasMovements: boolean;
  lineNames: ReadonlyMap<string, string>;
  currency: SupportedCurrency;
  isPending: (transaction: Transaction) => boolean;
  onToggle: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
  onViewAll: () => void;
}

/**
 * « Derniers mouvements »: the latest few, grouped by day, each with its
 * pointing circle. « Tout voir » opens the whole month; a tap opens the
 * movement for correction.
 */
export function RecentMovementsSection({
  transactions,
  hasMovements,
  lineNames,
  currency,
  isPending,
  onToggle,
  onEdit,
  onViewAll,
}: RecentMovementsSectionProps) {
  const theme = useTheme();
  const v2 = useV2Colors();
  const { locale, t } = useTranslation();
  const now = new Date();

  return (
    <View style={styles.section} testID="home-activity">
      <SectionHeader
        title={t("home.movements.latest")}
        link={
          hasMovements
            ? { label: t("home.movements.viewAll"), onPress: onViewAll }
            : undefined
        }
      />

      {transactions.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: v2.sunk }]}>
          <Text
            variant="bodyLarge"
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            {t("home.movements.empty")}
          </Text>
        </View>
      ) : (
        groupByDay(transactions).map((day) => (
          <View key={day.date.toISOString()} style={styles.day}>
            <Text
              variant="labelLarge"
              accessibilityRole="header"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {formatRelativeDay(day.date, now, locale)}
            </Text>
            <LedgerCard>
              {day.transactions.map((transaction) => (
                <MovementRow
                  key={transaction.id}
                  transaction={transaction}
                  lineName={
                    transaction.budgetLineId === null
                      ? undefined
                      : lineNames.get(transaction.budgetLineId)
                  }
                  currency={currency}
                  isSyncing={isPending(transaction)}
                  onToggle={() => onToggle(transaction)}
                  onOpen={() => onEdit(transaction)}
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
  empty: { borderRadius: RADIUS.card, padding: SPACING.xl },
  emptyText: { textAlign: "center" },
});
