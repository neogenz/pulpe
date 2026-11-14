import type { SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { SectionHeader } from "@/core/ui/section-header";
import { FormModal } from "@/core/ui/sheet";
import { SPACING, TABULAR_DIGITS } from "@/core/ui/theme";
import { useBudgetDetails } from "@/features/budgets/budget-queries";

import {
  elidedKey,
  recapFindings,
  recapSpending,
  type MonthRecap,
} from "../month-recap";

interface MonthRecapSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  recap: MonthRecap;
  currency: SupportedCurrency;
  /** « C'est noté »: retires the row. */
  onAcknowledge: () => void;
  onShowBudget: () => void;
}

/**
 * « Bilan d'octobre »: what the closed month carried over, the summary that
 * adds up to it, and « Ce qui a compté » read from that month's details.
 * Read-only. `MonthRecapSheet` on iOS.
 */
export function MonthRecapSheet({
  isVisible,
  onDismiss,
  recap,
  currency,
  onAcknowledge,
  onShowBudget,
}: MonthRecapSheetProps) {
  const { locale, t } = useTranslation();
  const theme = useTheme();
  const financial = useFinancialColors();
  // A failed load only drops « Ce qui a compté ».
  const details = useBudgetDetails(isVisible ? recap.budgetId : null).data;
  const amount = (value: number) => formatCurrency(value, currency);
  const closedName = formatMonthName(recap.month, recap.year, locale);
  // December hands over to January of the next year.
  const openedName = formatMonthName(
    recap.openedMonth,
    recap.month === 12 ? recap.year + 1 : recap.year,
    locale,
  );
  const previousName = formatMonthName(
    recap.month === 1 ? 12 : recap.month - 1,
    recap.month === 1 ? recap.year - 1 : recap.year,
    locale,
  );
  const findings =
    details === undefined
      ? []
      : recapFindings(
          t,
          details.budgetLines,
          details.transactions,
          closedName,
          amount,
        );
  const muted = { color: theme.colors.onSurfaceVariant };
  const figure = (value: number) => (
    <Text variant="titleMedium" style={TABULAR_DIGITS}>
      {amount(value)}
    </Text>
  );

  return (
    <FormModal
      isVisible={isVisible}
      onDismiss={onDismiss}
      title={t(elidedKey("home.recap.title", closedName), {
        month: closedName,
      })}
      footer={
        <View style={styles.actions}>
          <Button mode="contained" onPress={onAcknowledge}>
            {t("home.recap.acknowledge")}
          </Button>
          <Button mode="text" onPress={onShowBudget}>
            {t(elidedKey("home.recap.showBudget", closedName), {
              month: closedName,
            })}
          </Button>
        </View>
      }
    >
      <View style={styles.carryOver}>
        <Text variant="labelLarge" style={muted}>
          {t("home.recap.finished", {
            month:
              closedName.charAt(0).toLocaleUpperCase(locale) +
              closedName.slice(1),
          })}
        </Text>
        <Text variant="displaySmall" style={TABULAR_DIGITS}>
          {amount(recap.carriedOver)}
        </Text>
        <Text variant="bodyMedium" style={[muted, styles.centered]}>
          {t("home.recap.carriedCaption", { month: openedName })}
        </Text>
      </View>

      <LedgerCard testID="month-recap-summary" dividerInset={SPACING.md}>
        <LedgerRow
          title={t("home.recap.income")}
          trailing={figure(recap.income)}
        />
        <LedgerRow
          title={t(elidedKey("home.recap.report", previousName), {
            month: previousName,
          })}
          trailing={figure(recap.previousRollover)}
        />
        <LedgerRow
          title={t("home.recap.expenses")}
          trailing={figure(-recapSpending(recap))}
        />
        <LedgerRow
          title={t("home.recap.savings")}
          trailing={figure(-recap.savings)}
        />
        <LedgerRow
          title={t("home.recap.finalBalance")}
          trailing={figure(recap.carriedOver)}
        />
      </LedgerCard>

      {findings.length > 0 && (
        <View style={styles.findings}>
          <SectionHeader title={t("home.recap.findings.title")} />
          <LedgerCard testID="month-recap-findings" dividerInset={SPACING.md}>
            {findings.map((finding) => (
              <LedgerRow
                key={finding.title}
                title={finding.title}
                subtitle={finding.subtitle}
                trailing={
                  finding.overrun === undefined ? undefined : (
                    <Text
                      variant="titleMedium"
                      style={[TABULAR_DIGITS, { color: financial.overBudget }]}
                    >
                      {amount(finding.overrun)}
                    </Text>
                  )
                }
              />
            ))}
          </LedgerCard>
        </View>
      )}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  carryOver: { alignItems: "center", gap: SPACING.xs },
  centered: { textAlign: "center" },
  findings: { gap: SPACING.sm },
  actions: { gap: SPACING.xs },
});
