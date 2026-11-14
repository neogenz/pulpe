import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Searchbar, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatMonthName, formatRelativeDay } from "@/core/ui/date-format";
import { FilterChip } from "@/core/ui/filter-chip";
import { LedgerCard } from "@/core/ui/ledger";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
import { useV2Colors } from "@/core/ui/scheme-colors";
import { RADIUS, SPACING } from "@/core/ui/theme";

import { groupByDay } from "../activity-window";
import {
  countMovements,
  filterMovements,
  MOVEMENTS_FILTERS,
  type MovementsFilter,
} from "../home-presentation";
import { useMovementEditor } from "../use-movement-editor";
import { usePointingNotice } from "../use-pointing-notice";
import { type LoadedMonth, MonthPage } from "./month-page";
import { MovementRow } from "./movement-row";

/**
 * Every movement of the month, grouped by day: pushed from « Tout voir »,
 * searchable, filtered by chips. The circle points, a tap opens the movement.
 */
export function MovementsPage() {
  const { t } = useTranslation();

  return (
    <MonthPage title={t("home.movements.title")}>
      {(month) => <Movements month={month} />}
    </MonthPage>
  );
}

function Movements({ month }: { month: LoadedMonth }) {
  const theme = useTheme();
  const v2 = useV2Colors();
  const { locale, t } = useTranslation();
  const pull = usePullToRefresh(() => month.refresh());
  const [filter, setFilter] = useState<MovementsFilter>("all");
  const [query, setQuery] = useState("");
  const pointing = usePointingNotice(month.budgetId);
  const editor = useMovementEditor(
    month.budgetId,
    month.currency,
    month.period,
  );

  const { transactions, budgetLines, budget } = month.details;
  const lineNames = new Map(budgetLines.map((line) => [line.id, line.name]));
  const days = groupByDay(
    filterMovements(filter, query, transactions, lineNames),
  );
  const now = new Date();

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl {...pull} />}
      >
        <Text
          variant="bodyLarge"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("home.movements.subtitle", {
            month: formatMonthName(budget.month, budget.year, locale),
            count: transactions.length,
          })}
        </Text>

        <Searchbar
          value={query}
          onChangeText={setQuery}
          placeholder={t("home.movements.search")}
        />

        <View style={styles.chips}>
          {MOVEMENTS_FILTERS.map((option) => (
            <FilterChip
              key={option}
              selected={filter === option}
              onPress={() => setFilter(option)}
            >
              {option === "all"
                ? t("home.movements.filter.all")
                : `${t(`home.movements.filter.${option}`)} · ${countMovements(option, transactions)}`}
            </FilterChip>
          ))}
        </View>

        {days.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: v2.sunk }]}>
            <Text
              variant="bodyLarge"
              style={[
                styles.emptyText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {t(
                query === ""
                  ? "home.movements.nothing"
                  : "home.movements.noMatch",
              )}
            </Text>
          </View>
        ) : (
          days.map((day) => (
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
                    currency={month.currency}
                    isSyncing={pointing.isPending({
                      source: "transaction",
                      sourceId: transaction.id,
                    })}
                    onToggle={() =>
                      void pointing.point(
                        {
                          source: "transaction",
                          sourceId: transaction.id,
                          name: transaction.name,
                        },
                        transaction.checkedAt !== null,
                      )
                    }
                    onOpen={() => editor.edit(transaction)}
                  />
                ))}
              </LedgerCard>
            </View>
          ))
        )}
      </ScrollView>
      {pointing.element}
      {editor.element}
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  day: { gap: SPACING.sm },
  empty: { borderRadius: RADIUS.card, padding: SPACING.xl },
  emptyText: { textAlign: "center" },
});
