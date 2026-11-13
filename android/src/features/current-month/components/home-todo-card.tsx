import type { SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatCurrency } from "@/core/ui/amount-format";
import { areAmountsHidden } from "@/core/ui/amount-visibility";
import { formatRelativeDay } from "@/core/ui/date-format";
import { IconDisc } from "@/core/ui/icon-disc";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { SectionHeader } from "@/core/ui/section-header";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { SPACING } from "@/core/ui/theme";
import { recurrenceLabel } from "@/core/ui/vocabulary";

import type { CheckableItem, DriftLine } from "../current-month-view-model";
import {
  driftTitle,
  type LineFact,
  lineFact,
  movementPlace,
} from "../home-presentation";
import { PointRow } from "./point-row";

/** The likeliest few pointable right here; the rest wait on « À pointer ». */
const SUGGESTION_COUNT = 3;

interface HomeTodoCardProps {
  /** In the view model's order: learned pointing days first. */
  items: CheckableItem[];
  uncheckedCount: number;
  uncheckedMovementCount: number;
  drifts: DriftLine[];
  driftTotal: number;
  currency: SupportedCurrency;
  isPending: (item: CheckableItem) => boolean;
  onPoint: () => void;
  onPointItem: (item: CheckableItem) => void;
  onOpenItem: (item: CheckableItem) => void;
  onCatchUp: () => void;
}

/**
 * « À faire »: what asks for a gesture — what is left to point, with the
 * likeliest few pointable in place, then the forecasts that ran past their
 * plan. Nothing when there is nothing to do. `HomeTodoCard` on iOS, minus its
 * month-recap row, which Android has no model for.
 */
export function HomeTodoCard({
  items,
  uncheckedCount,
  uncheckedMovementCount,
  drifts,
  driftTotal,
  currency,
  isPending,
  onPoint,
  onPointItem,
  onOpenItem,
  onCatchUp,
}: HomeTodoCardProps) {
  const { locale, t } = useTranslation();
  const financial = useFinancialColors();

  if (items.length === 0 && drifts.length === 0) return null;

  const now = new Date();
  const rows = [];

  function suggestionFact(item: CheckableItem): LineFact {
    if (item.subtitle.kind === "recurrence" && item.consumption !== null) {
      const line = { kind: item.kind, recurrence: item.subtitle.value };
      return lineFact(t, line, item.consumption, currency);
    }
    const place = movementPlace(t, item.kind, item.envelopeName ?? undefined);
    const day =
      item.subtitle.kind === "date"
        ? formatRelativeDay(new Date(item.subtitle.value), now, locale)
        : recurrenceLabel(t, item.subtitle.value);
    return { text: `${place} · ${day}`, isOverrun: false, hasAmount: false };
  }

  if (items.length > 0) {
    rows.push(
      <LedgerRow
        key="to-point"
        testID="home-todo-to-point"
        leading={
          <IconDisc name="check-circle-outline" tint={financial.income} />
        }
        title={
          uncheckedCount > uncheckedMovementCount
            ? t("home.todo.toPoint", { count: uncheckedCount })
            : t("home.todo.toPointMovements", { count: uncheckedCount })
        }
        subtitle={t("home.todo.toPointHint")}
        onPress={onPoint}
      />,
      ...items.slice(0, SUGGESTION_COUNT).map((item) => {
        const fact = suggestionFact(item);
        return (
          <PointRow
            key={item.id}
            title={item.name}
            subtitle={
              fact.hasAmount && areAmountsHidden() ? undefined : fact.text
            }
            isOverrun={fact.isOverrun}
            amount={formatCurrency(item.amount, currency)}
            kind={item.kind}
            isPointed={false}
            isSyncing={isPending(item)}
            onToggle={() => onPointItem(item)}
            onOpen={() => onOpenItem(item)}
          />
        );
      }),
    );
  }

  if (drifts.length > 0) {
    rows.push(
      <LedgerRow
        key="drift"
        testID="home-todo-drift"
        leading={<IconDisc name="chart-line" tint={financial.drift} />}
        title={driftTitle(
          t,
          drifts.map((drift) => drift.line.name),
        )}
        subtitle={
          areAmountsHidden()
            ? undefined
            : t("home.todo.driftHint", {
                amount: formatCurrency(driftTotal, currency),
              })
        }
        onPress={onCatchUp}
      />,
    );
  }

  return (
    <View style={styles.section}>
      <SectionHeader title={t("home.todo.title")} />
      <LedgerCard testID="home-todo-card">{rows}</LedgerCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm + SPACING.xs },
});
