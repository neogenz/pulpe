import type { BudgetLine, SupportedCurrency, Transaction } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { formatAmount, formatCurrency } from "@/core/ui/amount-format";
import { useAmountVisibility } from "@/core/ui/amount-visibility";
import { formatMonthName } from "@/core/ui/date-format";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { SectionHeader } from "@/core/ui/section-header";
import { FormModal } from "@/core/ui/sheet";
import { SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

import { toCents } from "../balance-scrub";
import { calculationRows, gapCauses } from "../calculation-presentation";
import type { CurrentMonthViewModel } from "../current-month-view-model";
import {
  type HeroPresentation,
  rhythmSentence,
} from "../home-hero-presentation";
import { elidedKey } from "../month-recap";

interface CalculationSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  viewModel: CurrentMonthViewModel;
  /** The hero's own reading of the plan, so the two surfaces quote one number. */
  presentation: HeroPresentation;
  budgetLines: BudgetLine[];
  transactions: Transaction[];
  currency: SupportedCurrency;
  month: number;
  year: number;
  periodEnd: Date;
  /** « Comparer avec mes comptes », offered once the month's budget is loaded. */
  onReconcile?: () => void;
}

/**
 * « Le calcul », opened from the Accueil's hero: the disponible, the formula
 * that makes it, its gap to the plan explained, and the pointed balance that
 * leads to the reconciliation. The budget detail keeps `RealizedBalanceSheet`.
 * Mirrors `CalculationSheet` on iOS.
 */
export function CalculationSheet({
  isVisible,
  onDismiss,
  viewModel,
  presentation,
  budgetLines,
  transactions,
  currency,
  month,
  year,
  periodEnd,
  onReconcile,
}: CalculationSheetProps) {
  const { locale, t } = useTranslation();
  const theme = useTheme();
  const areHidden = useAmountVisibility((state) => state.areAmountsHidden);
  const muted = { color: theme.colors.onSurfaceVariant };
  const { metrics, realized, trajectory } = viewModel;
  const formula = (value: number) => formulaAmount(value, currency, areHidden);

  const previousName = formatMonthName(
    month === 1 ? 12 : month - 1,
    month === 1 ? year - 1 : year,
    locale,
  );
  const rows = calculationRows(t, {
    budgetLines,
    transactions,
    rollover: metrics.rollover,
    reportTitle: t(elidedKey("home.recap.report", previousName), {
      month: previousName,
    }),
  });

  const gap = toCents(presentation.variance) / 100;
  const causes =
    gap < 0
      ? gapCauses(
          t,
          viewModel.driftLines.map(({ line, consumption }) => ({
            name: line.name,
            overrun: -consumption.available,
          })),
          transactions.filter(
            (tx) => tx.budgetLineId == null && tx.kind === "expense",
          ),
          (value) => formatAmount(value, currency),
        )
      : null;
  const rhythm =
    trajectory &&
    rhythmSentence(t, locale, {
      trajectory,
      periodEnd,
      currency,
      amountsHidden: areHidden,
    });
  const explanation = [causes, rhythm].filter(Boolean).join(" ");

  const balance = formatAmount(realized.realizedBalance, currency);
  const sentence = t("home.calculation.checkedBalance", { amount: balance });
  const at = sentence.indexOf(balance);

  return (
    <FormModal
      isVisible={isVisible}
      onDismiss={onDismiss}
      title={t("home.hero.calculation")}
      footer={
        <View style={styles.footer}>
          <Text variant="bodySmall" style={[muted, styles.centered]}>
            {sentence.slice(0, at)}
            <Text
              style={[
                TABULAR_DIGITS,
                styles.bold,
                { color: theme.colors.onSurface },
              ]}
            >
              {balance}
            </Text>
            {sentence.slice(at + balance.length)}
          </Text>
          {onReconcile !== undefined && (
            <Button mode="outlined" icon="bank-outline" onPress={onReconcile}>
              {t("home.calculation.compare")}
            </Button>
          )}
        </View>
      }
    >
      <View accessible style={styles.figure}>
        <Text variant="labelLarge" style={muted}>
          {t("home.calculation.available", {
            month: formatMonthName(month, year, locale),
          })}
        </Text>
        <Amount size="hero" style={styles.shrink}>
          {formatCurrency(metrics.remaining, currency)}
        </Amount>
      </View>

      <LedgerCard testID="calculation-formula" dividerInset={SPACING.md}>
        {rows.map((row, index) => (
          <LedgerRow
            key={index}
            title={row.title}
            wrapsTitle
            subtitle={row.caption}
            trailing={<Amount size="row">{formula(row.amount)}</Amount>}
          />
        ))}
        <LedgerRow
          title={t("home.calculation.total")}
          trailing={
            <Amount size="row" style={styles.bold}>
              {formatAmount(metrics.remaining, currency)}
            </Amount>
          }
        />
      </LedgerCard>

      <View style={styles.section}>
        <SectionHeader title={t("home.calculation.plan")} />
        <LedgerCard testID="calculation-plan">
          <LedgerRow
            title={t("home.calculation.gap")}
            subtitle={t("home.calculation.plannedAtStart", {
              amount: formatAmount(presentation.plannedBalance, currency),
            })}
            trailing={
              <Amount
                size="row"
                tone={gap < 0 ? "overBudget" : "neutral"}
                style={gap > 0 && { color: theme.colors.primary }}
              >
                {formula(gap)}
              </Amount>
            }
          />
        </LedgerCard>
        {/* Names what was spent where: hidden with the amounts, as iOS blurs it. */}
        {explanation !== "" && !areHidden && (
          <Text variant="bodyMedium" style={muted}>
            {explanation}
          </Text>
        )}
      </View>
    </FormModal>
  );
}

/**
 * `+6’200.00` / `−4’197.00` / `0.00`: a line of a formula, signed by its own
 * value and written without the unit the figure above already carries. No sign
 * while masked: `+•••` still says which way the line goes.
 */
function formulaAmount(
  value: number,
  currency: SupportedCurrency,
  areHidden: boolean,
): string {
  const magnitude = formatAmount(Math.abs(value), currency);
  const cents = toCents(value);
  if (areHidden || cents === 0) return magnitude;
  return `${cents > 0 ? "+" : "−"}${magnitude}`;
}

const styles = StyleSheet.create({
  figure: { gap: SPACING.xs },
  shrink: { flexShrink: 1 },
  section: { gap: SPACING.sm },
  footer: { gap: SPACING.sm },
  centered: { textAlign: "center" },
  bold: { fontWeight: "700" },
});
