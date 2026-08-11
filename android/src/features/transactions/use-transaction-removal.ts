import type { Transaction } from "pulpe-shared";
import { useState } from "react";

import { buildTransactionRestore } from "./transaction-draft";
import {
  useDeleteTransaction,
  useRestoreTransaction,
} from "./transaction-mutations";

/**
 * Deleting an operation without a confirmation dialog, and offering the way
 * back instead. The row is gone the moment it is asked for, which is what the
 * user meant; the snapshot stays in hand until the snackbar closes, and putting
 * it back restores the same id — so a mistake costs one tap rather than
 * retyping an amount and a date.
 *
 * Only one deletion is held at a time: the snackbar can only offer one undo,
 * and a queue of them would let a second delete quietly bury the first.
 */
export function useTransactionRemoval() {
  const remove = useDeleteTransaction();
  const restore = useRestoreTransaction();
  const [undoable, setUndoable] = useState<Transaction | null>(null);
  const [hasFailed, setFailed] = useState(false);

  return {
    /** The operation whose deletion can still be taken back, if any. */
    undoable,
    hasFailed,
    isPending: remove.isPending || restore.isPending,
    remove: (transaction: Transaction, onRemoved?: () => void) =>
      remove.mutate(transaction.id, {
        onSuccess: () => {
          setUndoable(transaction);
          onRemoved?.();
        },
        onError: () => setFailed(true),
      }),
    undo: () => {
      if (undoable === null) return;
      restore.mutate(buildTransactionRestore(undoable), {
        onError: () => setFailed(true),
      });
      setUndoable(null);
    },
    forget: () => setUndoable(null),
    dismissFailure: () => setFailed(false),
  };
}
