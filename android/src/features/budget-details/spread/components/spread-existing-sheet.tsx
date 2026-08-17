import type { BudgetLine, SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { Button, Text, useTheme } from "react-native-paper";

import { hapticSuccess } from "@/core/ui/haptics";
import { formatCurrency } from "@/core/ui/amount-format";
import { Sheet } from "@/core/ui/sheet";
import { FieldError } from "@/core/ui/field-error";

import { useSpreadExistingLine } from "../spread-queries";
import {
  DEFAULT_SPREAD_LENGTH,
  selectedPeriods,
  type SpreadPeriod,
  spreadWindow,
  spreadWindowProblem,
} from "../spread-window";

import { SpreadFormSection } from "./spread-form-section";

/** Spreading over one month would be a no-op, so the endpoint refuses it. */
const MINIMUM_MONTHS = 2;

interface SpreadExistingSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  line: BudgetLine;
  anchor: SpreadPeriod;
  currency: SupportedCurrency;
  onSpread: () => void;
}

/**
 * Spreading a forecast that already exists redistributes its own total: the
 * months chosen here each take a share, and the original disappears into them.
 * There is no amount to type — the server reads it, and only it can guarantee
 * the shares add back up to what was there.
 */
export function SpreadExistingSheet({
  isVisible,
  onDismiss,
  line,
  anchor,
  currency,
  onSpread,
}: SpreadExistingSheetProps) {
  const theme = useTheme();
  const spread = useSpreadExistingLine();
  const [length, setLength] = useState(DEFAULT_SPREAD_LENGTH);
  const [deselected, setDeselected] = useState<string[]>([]);
  const cells = spreadWindow(anchor, length, deselected);
  const problem = spreadWindowProblem(cells, MINIMUM_MONTHS);

  function submit() {
    if (problem !== null) return;
    spread.mutate(
      { budgetLineId: line.id, periods: selectedPeriods(cells) },
      {
        onSuccess: () => {
          hapticSuccess();
          onSpread();
        },
      },
    );
  }

  return (
    <Sheet
      isVisible={isVisible}
      onDismiss={onDismiss}
      isBusy={spread.isPending}
      title={`Lisser « ${line.name} »`}
      // The month grid is a dozen rows on a long spread, and the button that
      // dissolves this forecast into them sits below it.
      footer={
        <>
          {spread.isError && (
            <FieldError visible>
              Le lissage n&apos;a pas pu être fait. Réessaie.
            </FieldError>
          )}

          <Button
            mode="contained"
            onPress={submit}
            disabled={problem !== null || spread.isPending}
            loading={spread.isPending}
          >
            Lisser
          </Button>
        </>
      }
    >
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {formatCurrency(line.amount, currency)} seront répartis sur les mois
        choisis. Cette prévision-ci disparaît au profit d&apos;eux.
      </Text>

      <SpreadFormSection
        cells={cells}
        mode="total"
        amount={line.amount}
        currency={currency}
        minimumMonths={MINIMUM_MONTHS}
        onChangeLength={setLength}
        onToggleMonth={(key) =>
          setDeselected((current) =>
            current.includes(key)
              ? current.filter((other) => other !== key)
              : [...current, key],
          )
        }
      />
    </Sheet>
  );
}
