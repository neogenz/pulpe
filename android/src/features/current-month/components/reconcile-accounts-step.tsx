import type { SupportedCurrency } from "pulpe-shared";
import { parseAccountAmount } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { SPACING, TABULAR_DIGITS, TOUCH_TARGET } from "@/core/ui/theme";

import type { AccountRow, RowsSummary } from "../reconcile-account-links";
import { ReconcileAccountRow } from "./reconcile-linked-account-row";

const CENTS_PER_UNIT = 100;

/** « 800.00 CHF » never breaks between its number and its currency. */
function figure(cents: number, currency: SupportedCurrency): string {
  return formatCurrency(cents / CENTS_PER_UNIT, currency).replace(
    / /g,
    "\u00A0",
  );
}

interface ReconcileAccountsStepProps {
  /** `null` while the accounts of Mon patrimoine are still loading. */
  rows: AccountRow[] | null;
  summary: RowsSummary;
  currency: SupportedCurrency;
  leftRowIds: ReadonlySet<number>;
  focusRowId: number | null;
  /** The new row's field has taken the keyboard: no later mount takes it again. */
  onFocusTaken: () => void;
  onChange: (
    id: number,
    changes: Partial<Omit<AccountRow, "id" | "account">>,
  ) => void;
  onLeaveAmount: (id: number) => void;
  onRemove: (id: number) => void;
  onAddAccount: () => void;
  onAddOwe: () => void;
}

/**
 * Step 1, « Combien as-tu aujourd'hui ? »: one row per account, what I have
 * minus what I owe, and the help for a card debt. `ReconcileAccountsStepView`
 * on iOS. The « Comparer » button is the sheet's footer.
 */
export function ReconcileAccountsStep({
  rows,
  summary,
  currency,
  leftRowIds,
  focusRowId,
  onFocusTaken,
  onChange,
  onLeaveAmount,
  onRemove,
  onAddAccount,
  onAddOwe,
}: ReconcileAccountsStepProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = { color: theme.colors.onSurfaceVariant };

  return (
    <>
      <View style={styles.header}>
        <Text variant="labelMedium" style={muted}>
          {t("home.reconcile.accounts.stepLabel")}
        </Text>
        <Text
          variant="headlineSmall"
          accessibilityRole="header"
          textBreakStrategy="balanced"
        >
          {t("home.reconcile.accounts.heading")}
        </Text>
        <Text variant="bodyMedium" style={muted} textBreakStrategy="balanced">
          {t("home.reconcile.accounts.hint")}
        </Text>
      </View>
      {rows === null && <ActivityIndicator />}
      {rows?.map((row, index) => (
        <ReconcileAccountRow
          key={row.id}
          row={row}
          number={index + 1}
          currency={currency}
          // Flagged once the field is left, never mid-keystroke: "12." is on
          // its way to "12.50". It never counts in the total either way.
          isUnreadable={
            leftRowIds.has(row.id) &&
            parseAccountAmount(row.amountText).status === "invalid"
          }
          autoFocus={row.id === focusRowId}
          onFocus={row.id === focusRowId ? onFocusTaken : undefined}
          onChange={(changes) => onChange(row.id, changes)}
          onLeaveAmount={() => onLeaveAmount(row.id)}
          onRemove={() => onRemove(row.id)}
        />
      ))}
      <Button
        mode="text"
        icon="plus"
        onPress={onAddAccount}
        style={styles.add}
        contentStyle={styles.addContent}
        disabled={rows === null}
      >
        {t("home.reconcile.accounts.addAccount")}
      </Button>
      {rows !== null && !summary.hasOwe && (
        <View style={styles.help}>
          <Text variant="bodyMedium" style={muted} textBreakStrategy="balanced">
            {t("home.reconcile.accounts.cardHelp")}
          </Text>
          <Button
            mode="text"
            onPress={onAddOwe}
            style={styles.add}
            contentStyle={styles.addContent}
          >
            {t("home.reconcile.accounts.addOwe")}
          </Button>
        </View>
      )}
      <View
        testID="reconcile-total"
        style={styles.total}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.grow}>
          <Text variant="titleSmall">{t("home.reconcile.accounts.total")}</Text>
          {summary.totalCents !== null && summary.hasOwe && (
            <Text variant="bodySmall" style={[muted, TABULAR_DIGITS]}>
              {t("home.reconcile.accounts.breakdown", {
                own: figure(summary.haveCents, currency),
                owe: figure(summary.oweCents, currency),
              })}
            </Text>
          )}
        </View>
        <Amount size="row" numberOfLines={1}>
          {summary.totalCents === null
            ? "—"
            : formatCurrency(summary.totalCents / CENTS_PER_UNIT, currency)}
        </Amount>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: SPACING.sm },
  // Paper insets a text button's icon or label by 12: pulled back by as much,
  // it starts on the sentence's edge.
  add: { alignSelf: "flex-start", marginLeft: -(SPACING.sm + SPACING.xs) },
  addContent: { minHeight: TOUCH_TARGET },
  help: { gap: SPACING.xs },
  total: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  grow: { flex: 1 },
});
