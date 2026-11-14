import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatAmount } from "@/core/ui/amount-format";
import { FieldError } from "@/core/ui/field-error";
import { hapticSuccess } from "@/core/ui/haptics";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { SectionHeader } from "@/core/ui/section-header";
import { FormModal } from "@/core/ui/sheet";
import { ICON_SIZE, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

import {
  type CatchUpChoice,
  catchUpImpact,
  catchUpPlan,
  defaultChoice,
  updatesFor,
} from "../catch-up-plan";
import { useUpdateBudgetLine } from "../budget-line-mutations";
import type { MonthLedger } from "../month-impact";

import {
  availableOfTitle,
  ImpactBlock,
  impactBlockFor,
} from "./impact-confirm-sheet";

interface CatchUpSheetProps {
  onDismiss: () => void;
  /** Called once every write has landed, with the sheet still to close. */
  onDone: () => void;
  ledger: MonthLedger;
  /** Opened from one prévision: only its overrun is taken back. */
  focusLineId: string | null;
  /** The month in a sentence: « novembre ». */
  monthName: string;
  currency: SupportedCurrency;
}

/**
 * « Rattraper » (`CatchUpSheet.swift`): take this month's overrun back on a
 * dépense that still has margin. Saving lowers that prévision and raises the
 * overrun ones by the same share; the movements stay where they are.
 *
 * Mount it while it is open: the plan is frozen at mount, because the first
 * write reloads the month under the sheet and would recompute the plan from a
 * half-applied state while the rest is still saving.
 */
export function CatchUpSheet({
  onDismiss,
  onDone,
  ledger: openedLedger,
  focusLineId,
  monthName,
  currency,
}: CatchUpSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const update = useUpdateBudgetLine();
  const [ledger] = useState(openedLedger);
  const [plan] = useState(() => catchUpPlan(ledger, focusLineId, currency));
  const [selectedId, setSelectedId] = useState(
    () => defaultChoice(plan)?.line.id ?? null,
  );
  const [hasFailed, setFailed] = useState(false);
  const [isBusy, setBusy] = useState(false);
  // A failed save may have written part of its sequence. Replaying the same
  // choice is safe (the amounts are absolute); another one would lower a second
  // prévision for the same overrun.
  const [isChoiceLocked, setChoiceLocked] = useState(false);
  const selected = plan.choices.find((choice) => choice.line.id === selectedId);
  const total = formatAmount(plan.total, currency);

  async function submit(choice: CatchUpChoice) {
    setBusy(true);
    setFailed(false);
    try {
      for (const { id, amount } of updatesFor(plan, choice)) {
        await update.mutateAsync({ id, amount, isManuallyAdjusted: true });
      }
      hapticSuccess();
      onDone();
    } catch {
      setFailed(true);
      setChoiceLocked(true);
    } finally {
      setBusy(false);
    }
  }

  const names = plan.overruns.map(({ line }) => line.name);
  const head =
    names.length === 1
      ? t("budgets.catchUp.bannerOne", { name: names[0], total })
      : names.length === 2
        ? t("budgets.catchUp.bannerTwo", {
            first: names[0],
            second: names[1],
            total,
          })
        : t("budgets.catchUp.bannerMany", { count: names.length, total });

  return (
    <FormModal
      isVisible
      onDismiss={onDismiss}
      isBusy={isBusy}
      title={t("budgets.catchUp.title")}
      footer={
        selected === undefined ? undefined : (
          <>
            {hasFailed && (
              <FieldError visible>{t("budgets.catchUp.error")}</FieldError>
            )}
            <Button
              mode="contained"
              loading={isBusy}
              disabled={isBusy}
              onPress={() => void submit(selected)}
            >
              {t("budgets.catchUp.submit", { name: selected.line.name })}
            </Button>
          </>
        )
      }
    >
      {plan.overruns.length === 0 ? (
        <Text variant="bodyMedium">{t("budgets.detail.noOver")}</Text>
      ) : (
        <>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {`${head} ${t(names.length === 1 ? "budgets.catchUp.inviteOne" : "budgets.catchUp.inviteMany")}`}
          </Text>

          <LedgerCard>
            <LedgerRow
              title={t("budgets.catchUp.toTakeBack")}
              trailing={
                <Text variant="titleMedium" style={TABULAR_DIGITS}>
                  {total}
                </Text>
              }
              subtitle={
                names.length > 1
                  ? plan.overruns
                      .map(
                        ({ line, amount }) =>
                          `${line.name} ${formatAmount(amount, currency)}`,
                      )
                      .join(" · ")
                  : undefined
              }
            />
          </LedgerCard>

          {plan.choices.length === 0 ? (
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("budgets.catchUp.noChoice")}
            </Text>
          ) : (
            <>
              <SectionHeader title={t("budgets.catchUp.whichForecast")} />
              <LedgerCard>
                {plan.choices.map((choice) => (
                  <LedgerRow
                    key={choice.line.id}
                    title={choice.line.name}
                    subtitle={
                      choice.coversAll
                        ? t("budgets.catchUp.coversAll", {
                            remaining: formatAmount(choice.remaining, currency),
                            amount: formatAmount(choice.newAmount, currency),
                          })
                        : t("budgets.catchUp.coversPart", {
                            remaining: formatAmount(choice.remaining, currency),
                          })
                    }
                    trailing={
                      choice.line.id === selectedId ? (
                        <MaterialCommunityIcons
                          name="check"
                          size={ICON_SIZE.lg}
                          color={theme.colors.primary}
                        />
                      ) : (
                        <View style={styles.checkSpace} />
                      )
                    }
                    onPress={
                      isChoiceLocked
                        ? undefined
                        : () => setSelectedId(choice.line.id)
                    }
                  />
                ))}
              </LedgerCard>
            </>
          )}

          {selected !== undefined && (
            <ImpactBlock
              currency={currency}
              {...impactBlockFor(
                catchUpImpact(plan, selected, ledger),
                availableOfTitle(t, monthName),
                t("budgets.catchUp.impactNote", {
                  name: selected.line.name,
                  from: formatAmount(selected.line.amount, currency),
                  to: formatAmount(selected.newAmount, currency),
                  month: monthName,
                }),
              )}
            />
          )}
        </>
      )}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  checkSpace: { width: ICON_SIZE.lg, height: SPACING.lg },
});
