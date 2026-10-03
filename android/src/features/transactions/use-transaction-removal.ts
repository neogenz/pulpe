import type { Transaction } from "pulpe-shared";
import { useRef, useState } from "react";

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
  const [failure, setFailure] = useState<"delete" | "undo" | null>(null);
  // The id whose restore is in flight. A ref, not `restore.isPending`: two taps
  // inside one frame both read the render's stale `false` and would send the
  // same create twice, the second one bouncing off the id the first put back.
  const restoring = useRef<string | null>(null);
  // Set by `undo` for the length of the press that called it. Paper's Snackbar
  // fires `onDismiss` straight after the action's `onPress`, every time
  // (`Snackbar.tsx`: `onPressAction(); onDismiss();`), and that dismissal is
  // not the user letting the notice go: honouring it emptied the whole stack
  // on the first undo, and left a failed restore nothing to retry.
  const isUndoPress = useRef(false);

  const last = undoable.at(-1) ?? null;

  /**
   * One awaited call per deletion. `mutate(variables, callbacks)` keeps only
   * the latest call's callbacks, so deleting a second row before the first
   * answered dropped the first from the stack: its deletion went through and
   * nothing could take it back.
   */
  async function removeOne(transaction: Transaction, onRemoved?: () => void) {
    try {
      await remove.mutateAsync(transaction);
    } catch {
      setFailure("delete");
      return;
    }
    setUndoable((current) => [...current, transaction]);
    onRemoved?.();
  }

  // The entry leaves the stack only once the server has the row back:
  // dropping it first turned a failed restore into a deletion nobody could
  // take back a second time. It leaves by id, since a deletion made while the
  // restore was in flight is now the last entry, and not the one restored.
  async function restoreOne(transaction: Transaction) {
    restoring.current = transaction.id;
    try {
      await restore.mutateAsync(buildTransactionRestore(transaction));
      setUndoable((current) =>
        current.filter((entry) => entry.id !== transaction.id),
      );
    } catch {
      setFailure("undo");
    } finally {
      restoring.current = null;
    }
  }

  return {
    /** The operations whose deletion can still be taken back, latest last. */
    undoable,
    /** What the snackbar names, and what the next undo would bring back. */
    last,
    /** Names the step that failed: a lost undo is not a failed deletion. */
    failure,
    isPending: remove.isPending || restore.isPending,
    remove: (transaction: Transaction, onRemoved?: () => void) => {
      void removeOne(transaction, onRemoved);
    },
    undo: () => {
      isUndoPress.current = true;
      // Cleared once the press that set it has finished: a caller that undoes
      // without dismissing must not swallow the next real dismissal.
      queueMicrotask(() => {
        isUndoPress.current = false;
      });
      if (last === null || restoring.current !== null) return;
      void restoreOne(last);
    },
    /**
     * The notice ran out. A restore still in flight keeps its entry, so that
     * if it fails the row can still be asked for again.
     */
    forget: () => {
      if (isUndoPress.current) {
        isUndoPress.current = false;
        return;
      }
      // Read now: the updater runs at the next render, by which time the
      // restore may have settled and cleared the ref.
      const inFlight = restoring.current;
      setUndoable((current) =>
        current.filter((entry) => entry.id === inFlight),
      );
    },
    dismissFailure: () => setFailure(null),
  };
}
