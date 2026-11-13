import type { SupportedCurrency } from "pulpe-shared";
import { View } from "react-native";
import { useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { InlineQueryError } from "@/core/ui/inline-query-error";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { SectionHeader } from "@/core/ui/section-header";
import { StateChip } from "@/core/ui/state-chip";
import { SPACING } from "@/core/ui/theme";

import type { UpcomingItem } from "../goal-presentation";
import { GoalWithdrawalRow } from "./goal-withdrawal-row";

interface GoalUpcomingProps {
  items: UpcomingItem[];
  currency: SupportedCurrency;
  /** The withdrawals could not load: the list may be missing some. */
  hasWithdrawalsFailed: boolean;
  onRetry: () => void;
}

/**
 * « À venir » — `GoalUpcomingSection.swift`: runs of months ahead and the
 * withdrawals still to come, on one line of time.
 */
export function GoalUpcoming({
  items,
  currency,
  hasWithdrawalsFailed,
  onRetry,
}: GoalUpcomingProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (items.length === 0 && !hasWithdrawalsFailed) return null;

  return (
    <View style={{ gap: SPACING.sm }}>
      <SectionHeader title={t("goals.detail.upcoming")} />
      {items.length > 0 && (
        <LedgerCard>
          {items.map((item) =>
            item.kind === "months" ? (
              <LedgerRow
                key={item.id}
                title={item.run.title}
                subtitle={item.run.subtitle}
                trailing={
                  item.run.amount === null ? (
                    <StateChip tint={theme.colors.onSurfaceVariant}>
                      {t("goals.detail.nothingPlanned")}
                    </StateChip>
                  ) : (
                    <Amount size="row">
                      {formatCurrency(item.run.amount, currency)}
                    </Amount>
                  )
                }
              />
            ) : (
              <GoalWithdrawalRow
                key={item.id}
                name={item.name}
                subtitle={item.subtitle}
                amount={item.amount}
                currency={currency}
                budgetId={item.budgetId}
              />
            ),
          )}
        </LedgerCard>
      )}
      {hasWithdrawalsFailed && (
        <InlineQueryError
          message={t("goals.withdrawals.loadError")}
          onRetry={onRetry}
        />
      )}
    </View>
  );
}
