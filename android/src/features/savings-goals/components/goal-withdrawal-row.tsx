import { router } from "expo-router";
import type { SupportedCurrency } from "pulpe-shared";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { LedgerRow } from "@/core/ui/ledger";

interface GoalWithdrawalRowProps {
  name: string;
  subtitle: string;
  amount: number;
  currency: SupportedCurrency;
  /** Absent for a withdrawal that lives in the plan only. */
  budgetId: string | null;
}

/**
 * Money taken back out of the goal. Amounts travel positive on the wire; the
 * minus sign is this screen's decision, and a withdrawal stays in ordinary ink
 * — it is a decision, never an anomaly.
 */
export function GoalWithdrawalRow({
  name,
  subtitle,
  amount,
  currency,
  budgetId,
}: GoalWithdrawalRowProps) {
  const { t } = useTranslation();

  return (
    <LedgerRow
      title={name}
      subtitle={subtitle}
      trailing={
        <Amount size="row">{`−${formatCurrency(amount, currency)}`}</Amount>
      }
      onPress={
        budgetId === null ? undefined : () => router.push(`/budget/${budgetId}`)
      }
      accessibilityLabel={
        budgetId === null
          ? undefined
          : t("goals.withdrawals.openBudget", { name })
      }
    />
  );
}
