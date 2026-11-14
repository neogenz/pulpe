import { useState } from "react";

import { useTranslation } from "@/core/i18n/locale-store";
import { hapticFailure, hapticSuccess } from "@/core/ui/haptics";
import { Notice } from "@/core/ui/notice";
import {
  usePendingCheck,
  useToggleCheck,
} from "@/features/budgets/toggle-check-mutation";
import type { CheckTarget } from "@/features/budgets/toggle-check-api";

export interface PointedItem extends CheckTarget {
  name: string;
}

type PointingNotice =
  | { kind: "pointed"; item: PointedItem }
  | { kind: "failure"; step: "point" | "undo" };

/**
 * Pointing from a page of its own: the mutation, its pending state, and the
 * notice that offers the way back — or names the step that failed. The home
 * keeps its own slot, shared with the news of its sheets.
 */
export function usePointingNotice(budgetId: string | null) {
  const { t } = useTranslation();
  const toggle = useToggleCheck(budgetId);
  const isPending = usePendingCheck(budgetId);
  const [notice, setNotice] = useState<PointingNotice | null>(null);

  /**
   * Resolves to whether the server kept it. Taking a pointing back on purpose
   * needs no notice of its own.
   */
  async function point(
    item: PointedItem,
    wasPointed = false,
  ): Promise<boolean> {
    try {
      await toggle.mutateAsync(item);
    } catch {
      hapticFailure();
      setNotice({ kind: "failure", step: "point" });
      return false;
    }
    hapticSuccess();
    setNotice(wasPointed ? null : { kind: "pointed", item });
    return true;
  }

  /** Taking a pointing back is the same call a second time. */
  function undo(item: PointedItem) {
    setNotice(null);
    toggle
      .mutateAsync(item)
      .catch(() => setNotice({ kind: "failure", step: "undo" }));
  }

  return {
    point,
    undo,
    isPending,
    element: (
      <Notice
        clearsFab
        visible={notice !== null}
        onDismiss={() => setNotice(null)}
        action={
          notice?.kind === "pointed"
            ? {
                label: t("common.cancel"),
                onPress: () => undo(notice.item),
              }
            : notice?.kind === "failure"
              ? { label: t("common.close"), onPress: () => setNotice(null) }
              : undefined
        }
      >
        {notice === null
          ? ""
          : notice.kind === "pointed"
            ? t("home.checking.pointed", { name: notice.item.name })
            : t(`home.checking.${notice.step}Failure`)}
      </Notice>
    ),
  };
}
