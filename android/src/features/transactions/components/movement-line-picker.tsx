import type {
  BudgetLine,
  SupportedCurrency,
  TransactionKind,
} from "pulpe-shared";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Fragment, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Divider, Searchbar, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatCurrency } from "@/core/ui/amount-format";
import { useRipple } from "@/core/ui/ripple";
import { useFinancialColors, useV2Colors } from "@/core/ui/scheme-colors";
import {
  ICON_SIZE,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
  TOUCH_TARGET,
} from "@/core/ui/theme";
import { recurrenceLabel } from "@/core/ui/vocabulary";

import { type LineSections, matchingSections } from "../movement-line-choices";

interface MovementLinePickerProps {
  sections: LineSections;
  kind: TransactionKind;
  currency: SupportedCurrency;
  selectedLineId: string | null;
  /** Null is « Non, c'est un imprévu ». */
  onPick: (lineId: string | null) => void;
}

/**
 * « Dans quelle prévision ? »: the prévisions of the movement's kind in three
 * sections, under a search by name and the card that says what leaving it
 * unplanned costs. The step the sheet shows in place of its form, as the
 * pushed list does on iOS.
 */
export function MovementLinePicker({
  sections,
  kind,
  currency,
  selectedLineId,
  onPick,
}: MovementLinePickerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const v2 = useV2Colors();
  const ripple = useRipple();
  const financial = useFinancialColors();
  const [query, setQuery] = useState("");
  const shown = matchingSections(sections, query);
  const hasMatch =
    shown.margin.length + shown.over.length + shown.others.length > 0;

  // Always laid out, only shown when picked, so a row never shifts on selection.
  function check(isSelected: boolean, testID: string) {
    return (
      <MaterialCommunityIcons
        testID={testID}
        name="check"
        size={ICON_SIZE.md}
        color={isSelected ? v2.accentInk : "transparent"}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  function row(line: BudgetLine, section: "margin" | "over" | "others") {
    const isSelected = line.id === selectedLineId;
    const isOver = section === "over";
    const isPlanned = section === "others";
    const available = sections.available.get(line.id) ?? 0;
    const subtitle = isPlanned
      ? line.checkedAt === null
        ? recurrenceLabel(t, line.recurrence)
        : t("budgets.mutations.activity.picker.pointedRecurrence", {
            recurrence: recurrenceLabel(t, line.recurrence),
          })
      : t("budgets.mutations.activity.picker.planned", {
          amount: formatCurrency(line.amount, currency),
        });
    const caption = isOver
      ? t("budgets.mutations.activity.picker.over")
      : t(
          `budgets.mutations.activity.picker.${isPlanned ? "plannedCaption" : "left"}`,
        );

    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected }}
        android_ripple={ripple}
        onPress={() => onPick(line.id)}
        style={styles.row}
      >
        <View style={styles.grow}>
          <Text
            variant="bodyLarge"
            style={isSelected ? { color: v2.accentInk } : undefined}
          >
            {line.name}
          </Text>
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {subtitle}
          </Text>
        </View>
        <View style={styles.trailing}>
          <Text
            variant="titleSmall"
            style={[
              TABULAR_DIGITS,
              isOver ? { color: financial.overBudget } : undefined,
            ]}
          >
            {formatCurrency(
              isPlanned ? line.amount : Math.abs(available),
              currency,
            )}
          </Text>
          <Text
            variant="labelMedium"
            style={{
              color: isOver
                ? financial.overBudget
                : theme.colors.onSurfaceVariant,
            }}
          >
            {caption}
          </Text>
        </View>
        {check(isSelected, `movement-picker-check-${line.id}`)}
      </Pressable>
    );
  }

  function section(
    key: "margin" | "over" | "others",
    title: string,
    lines: BudgetLine[],
  ) {
    if (lines.length === 0) return null;
    return (
      <View key={key} style={styles.section}>
        <Text
          variant="labelLarge"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {title}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          {lines.map((line, index) => (
            <Fragment key={line.id}>
              {index > 0 && <Divider style={styles.divider} />}
              {row(line, key)}
            </Fragment>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Searchbar
        testID="movement-picker-search"
        value={query}
        onChangeText={setQuery}
        placeholder={t("budgets.mutations.activity.picker.search")}
      />
      <Pressable
        testID="movement-picker-unplanned"
        accessibilityRole="radio"
        accessibilityState={{ checked: selectedLineId === null }}
        android_ripple={ripple}
        onPress={() => onPick(null)}
        style={[styles.card, styles.row, { backgroundColor: v2.sunk }]}
      >
        <View style={styles.grow}>
          <Text variant="bodyLarge">
            {t("budgets.mutations.activity.unplanned")}
          </Text>
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("budgets.mutations.activity.picker.unplannedHint")}
          </Text>
        </View>
        {check(selectedLineId === null, "movement-picker-check-unplanned")}
      </Pressable>
      {section(
        "margin",
        t("budgets.mutations.activity.picker.margin"),
        shown.margin,
      )}
      {section(
        "over",
        t("budgets.mutations.activity.picker.overSection"),
        shown.over,
      )}
      {section(
        "others",
        t(
          `budgets.mutations.activity.picker.${kind === "income" ? "otherIncome" : "otherExpense"}`,
        ),
        shown.others,
      )}
      {!hasMatch && query.trim() !== "" && (
        <Text
          variant="bodyLarge"
          style={[styles.noMatch, { color: theme.colors.onSurfaceVariant }]}
        >
          {t("budgets.mutations.activity.picker.noMatch")}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACING.md },
  section: { gap: SPACING.sm },
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: TOUCH_TARGET,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  grow: { flex: 1 },
  trailing: { alignItems: "flex-end" },
  divider: { marginHorizontal: SPACING.md },
  noMatch: { textAlign: "center", paddingVertical: SPACING.lg },
});
