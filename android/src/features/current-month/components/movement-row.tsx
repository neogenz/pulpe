import type { SupportedCurrency, Transaction } from "pulpe-shared";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatCurrency } from "@/core/ui/amount-format";

import { movementSubtitle } from "../home-presentation";
import { PointRow } from "./point-row";

interface MovementRowProps {
  transaction: Transaction;
  lineName: string | undefined;
  currency: SupportedCurrency;
  isSyncing: boolean;
  onToggle: () => void;
  onOpen: () => void;
}

/** A movement on the home and on the Mouvements page: the same row, the same words. */
export function MovementRow({
  transaction,
  lineName,
  currency,
  isSyncing,
  onToggle,
  onOpen,
}: MovementRowProps) {
  const { t } = useTranslation();
  const amount = formatCurrency(transaction.amount, currency);

  return (
    <PointRow
      title={transaction.name}
      subtitle={movementSubtitle(t, transaction, lineName)}
      // An income keeps its `+`: nothing else tells it apart from an outflow.
      amount={transaction.kind === "income" ? `+${amount}` : amount}
      kind={transaction.kind}
      isPointed={transaction.checkedAt !== null}
      isSyncing={isSyncing}
      onToggle={onToggle}
      onOpen={onOpen}
    />
  );
}
