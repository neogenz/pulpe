import type {
  BudgetPeriod,
  SupportedCurrency,
  Transaction,
} from "pulpe-shared";
import { useState } from "react";
import { Button } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatMonthName } from "@/core/ui/date-format";
import { useBudgetPeriods } from "@/features/budgets/budget-queries";
import { ImpactConfirmSheet } from "@/features/budget-details/components/impact-confirm-sheet";
import {
  hasBudgetForPeriod,
  postponeTargetPeriod,
} from "@/features/budget-details/postpone-gate";

import { isMovementPostponeEligible } from "../movement-postpone-gate";
import { usePostponeTransaction } from "../transaction-mutations";

interface MovementPostponeActionProps {
  transaction: Transaction;
  /** The month the movement sits in. */
  period: BudgetPeriod;
  currency: SupportedCurrency;
  onPostponed: () => void;
}

/**
 * « Reporter » in the edit sheet of a free, unpointed movement, offered only
 * once next month's budget is known to exist (iOS hides it otherwise).
 */
export function MovementPostponeAction({
  transaction,
  period,
  currency,
  onPostponed,
}: MovementPostponeActionProps) {
  const { locale, t } = useTranslation();
  const target = postponeTargetPeriod(period);
  const periods = useBudgetPeriods(target.year);
  const postpone = usePostponeTransaction();
  const [isConfirming, setConfirming] = useState(false);

  if (
    !isMovementPostponeEligible(transaction) ||
    !periods.isSuccess ||
    !hasBudgetForPeriod(periods.data, target)
  ) {
    return null;
  }

  return (
    <>
      <Button
        testID="transaction-postpone"
        mode="outlined"
        onPress={() => setConfirming(true)}
      >
        {t("budgets.postpone.confirm")}
      </Button>
      <ImpactConfirmSheet
        isVisible={isConfirming}
        onDismiss={() => {
          postpone.reset();
          setConfirming(false);
        }}
        title={t("budgets.postpone.title", {
          month: formatMonthName(target.month, target.year, locale),
        })}
        currency={currency}
        confirmLabel={t("budgets.postpone.confirm")}
        isBusy={postpone.isPending}
        error={
          postpone.isError ? t("budgets.actions.line.failure.postpone") : null
        }
        onConfirm={() =>
          postpone.mutate(transaction.id, {
            onSuccess: () => {
              setConfirming(false);
              onPostponed();
            },
          })
        }
      />
    </>
  );
}
