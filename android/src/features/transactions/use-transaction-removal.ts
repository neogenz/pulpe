import type { Transaction } from "pulpe-shared";
import { useState } from "react";

import { buildTransactionRestore } from "./transaction-draft";
import {
  useDeleteTransaction,
  useRestoreTransaction,
} from "./transaction-mutations";

/**
 * Deleting operations without a confirmation dialog, offering the way back
 * instead. The row goes the moment it is asked for, which is what the user
 * meant; the snapshot stays in hand until the snackbar closes, and putting it
 * back restores the same id — so a mistake costs one tap rather than retyping
 * an amount and a date.
 *
 * The stack is why deleting three rows in a row is safe: undo takes them back
 * latest-first, and no deletion is buried by the next one.
 *
 * iOS holds the DELETE itself until its toast expires. That saves a round trip
 * on undo and costs a class of races the deferred call has to be defended
 * against — a reload landing inside the window, the screen dying with the call
 * still pending, a month change mid-toast. Sending it straight away and
 * re-creating the same row on undo has neither problem, because the create
 * schema takes a client-chosen id.
 */
export function useTransactionRemoval() {
  const remove = useDeleteTransaction();
  const restore = useRestoreTransaction();
  const [undoable, setUndoable] = useState<Transaction[]>([]);
  const [hasFailed, setFailed] = useState(false);

  const last = undoable.at(-1) ?? null;

  return {
    /** The operations whose deletion can still be taken back, latest last. */
    undoable,
    /** What the snackbar names, and what the next undo would bring back. */
    last,
    hasFailed,
    isPending: remove.isPending || restore.isPending,
    remove: (transaction: Transaction, onRemoved?: () => void) =>
      remove.mutate(transaction.id, {
        onSuccess: () => {
          setUndoable((current) => [...current, transaction]);
          onRemoved?.();
        },
        onError: () => setFailed(true),
      }),
    undo: () => {
      if (last === null) return;
      restore.mutate(buildTransactionRestore(last), {
        onError: () => setFailed(true),
      });
      setUndoable((current) => current.slice(0, -1));
    },
    forget: () => setUndoable([]),
    dismissFailure: () => setFailed(false),
  };
}
