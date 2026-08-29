import type { SupportedCurrency, TransactionKind } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { IconDisc } from "@/core/ui/icon-disc";
import { Eyebrow } from "@/core/ui/eyebrow";
import { hapticCommit, hapticSelection } from "@/core/ui/haptics";
import { Amount } from "@/core/ui/amount";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { EMPHASIS, RADIUS, SPACING } from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";
import { formatDayMonth } from "@/core/ui/date-format";
import { recurrenceLabel } from "@/core/ui/vocabulary";

import type { CheckableItem } from "../current-month-view-model";

const KIND_ICONS = {
  income: "arrow-down",
  expense: "arrow-up",
  saving: "piggy-bank-outline",
} as const satisfies Record<TransactionKind, string>;

const KIND_ACCENTS: Record<TransactionKind, "income" | "expense" | "savings"> =
  {
    income: "income",
    expense: "expense",
    saving: "savings",
  };

interface UncheckedOperationsCardProps {
  items: CheckableItem[];
  currency: SupportedCurrency;
  isSyncing: boolean;
  onToggle: (item: CheckableItem) => void;
}

/**
 * One operation at a time, with the two answers under it. A list of five with
 * five checkboxes is a chore; one question with "C'est passé" and "Plus tard"
 * is a habit — which is the whole point of pointing.
 *
 * The one tinted container under the hero: everything else on the page sits
 * on the background as rows, so the eye lands here, on the one thing to do.
 */
export function UncheckedOperationsCard({
  items,
  currency,
  isSyncing,
  onToggle,
}: UncheckedOperationsCardProps) {
  const theme = useTheme();
  const financial = useFinancialColors();
  const { locale, t } = useTranslation();
  const [skippedIds, setSkippedIds] = useState<string[]>([]);

  // Pruned at render rather than in an effect: an operation that was deferred
  // and has since been pointed elsewhere is simply gone from `items`, and a
  // stale id left in the set would make the rotation wrap one turn early.
  const deferredIds = skippedIds.filter((id) =>
    items.some((item) => item.id === id),
  );
  // Deferring the last one would leave the card empty while operations remain,
  // so the rotation wraps instead of running out.
  const current =
    items.find((item) => !deferredIds.includes(item.id)) ?? items[0];

  if (current === undefined) return null;

  const accent = financial[KIND_ACCENTS[current.kind]];
  const ink = theme.colors.onSecondaryContainer;

  function handleConfirm() {
    // `commit`, not `success`: nothing has succeeded yet. The buzz that says
    // the app kept what was asked of it belongs to the mutation's answer, and
    // fired here it confirmed pointings that went on to fail — the hand saying
    // "done" while the screen was about to say "not saved".
    hapticCommit();
    onToggle(current);
  }

  function handleSkip() {
    hapticSelection();
    setSkippedIds(
      deferredIds.length + 1 >= items.length
        ? []
        : [...deferredIds, current.id],
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.secondaryContainer },
      ]}
    >
      <Eyebrow style={{ color: ink }}>
        {`${t("home.checking.title")} · ${items.length}`}
      </Eyebrow>

      <View style={styles.operation}>
        <IconDisc name={KIND_ICONS[current.kind]} tint={accent} />

        <View style={styles.labels}>
          <Text variant="bodyLarge" numberOfLines={1} style={{ color: ink }}>
            {current.name}
          </Text>
          <Text variant="labelMedium" style={{ color: ink }}>
            {current.subtitle.kind === "date"
              ? formatDayMonth(new Date(current.subtitle.value), locale)
              : recurrenceLabel(t, current.subtitle.value)}
          </Text>
        </View>

        <Amount size="row" numberOfLines={1} style={{ color: ink }}>
          {formatCompactCurrency(current.amount, currency)}
        </Amount>
      </View>

      {/* The wait is worn by the controls, not by the card: dimming the whole
          thing took the question — name, subtitle, amount — to 2.23:1, and
          the operation someone is being asked about has to stay readable
          while the answer is in flight. Both buttons are `disabled` anyway,
          which is the state opacity is allowed to express. */}
      {/* `contained`, not `contained-tonal`: a tonal button is painted in
          `secondaryContainer`, the very colour of the card it sits on. */}
      <View style={[styles.actions, isSyncing && styles.syncing]}>
        <Button
          mode="text"
          textColor={ink}
          disabled={isSyncing}
          onPress={handleSkip}
          accessibilityLabel={t("home.checking.laterAccessibility", {
            name: current.name,
          })}
        >
          {t("home.checking.later")}
        </Button>
        <Button
          mode="contained"
          icon="check"
          disabled={isSyncing}
          onPress={handleConfirm}
          accessibilityLabel={t("home.checking.confirmAccessibility", {
            name: current.name,
          })}
        >
          {t("home.checking.confirm")}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  syncing: { opacity: EMPHASIS.pending },
  operation: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  labels: { flex: 1, gap: SPACING.xxs },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: SPACING.sm,
  },
});
