import type { SupportedCurrency, TemplateLine } from "pulpe-shared";
import { StyleSheet, View } from "react-native";

import { KIND_ICONS, recurrenceLabel } from "@/core/ui/vocabulary";
import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { IconDisc } from "@/core/ui/icon-disc";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { SectionHeader } from "@/core/ui/section-header";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCompactCurrency, formatCurrency } from "@/core/ui/amount-format";
import { SPACING } from "@/core/ui/theme";

import { templateLineSections } from "../template-vm";

interface TemplateLinesProps {
  lines: TemplateLine[];
  currency: SupportedCurrency;
  isDeleting: boolean;
  onEdit: (line: TemplateLine) => void;
  onDelete: (line: TemplateLine) => void;
}

/**
 * The model's forecasts, grouped by nature — income first, then what leaves —
 * each group a titled ledger card. A row opens its editor; a long press asks to
 * remove it, which is the gesture the budget's own rows already answer to, and
 * keeps two icon buttons from eating the name on every line.
 */
export function TemplateLines({
  lines,
  currency,
  isDeleting,
  onEdit,
  onDelete,
}: TemplateLinesProps) {
  const { t } = useTranslation();
  const financial = useFinancialColors();
  const tint = {
    income: financial.income,
    expense: financial.expense,
    saving: financial.savings,
  } as const;

  return (
    <>
      {templateLineSections(lines).map((section) => (
        <View key={section.kind} style={styles.section}>
          <SectionHeader
            title={t(`templates.sections.${section.kind}`)}
            count={section.lines.length}
            // Compact: the section total restates the summary above, which
            // rounds — printing centimes here made one number look like two.
            // The lines below keep theirs; they are edited.
            subtitle={formatCompactCurrency(section.total, currency)}
          />

          <LedgerCard>
            {section.lines.map((line) => (
              <LedgerRow
                key={line.id}
                leading={
                  <IconDisc
                    name={KIND_ICONS[line.kind]}
                    tint={tint[line.kind]}
                  />
                }
                title={line.name}
                subtitle={recurrenceLabel(t, line.recurrence)}
                trailing={
                  <Amount
                    size="row"
                    numberOfLines={1}
                    style={
                      line.kind === "expense"
                        ? undefined
                        : { color: tint[line.kind] }
                    }
                  >
                    {formatCurrency(line.amount, currency)}
                  </Amount>
                }
                onPress={() => onEdit(line)}
                onLongPress={isDeleting ? undefined : () => onDelete(line)}
                accessibilityLabel={t("templates.lines.editAccessibility", {
                  name: line.name,
                })}
                accessibilityHint={t("templates.lines.longPressHint")}
              />
            ))}
          </LedgerCard>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm },
});
