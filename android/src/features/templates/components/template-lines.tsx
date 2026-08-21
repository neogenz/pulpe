import type { SupportedCurrency, TemplateLine } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Divider, IconButton, Text, useTheme } from "react-native-paper";

import { recurrenceLabel } from "@/core/ui/vocabulary";
import { useTranslation } from "@/core/i18n/locale-store";
import { Card } from "@/core/ui/card";
import { Amount } from "@/core/ui/amount";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCompactCurrency, formatCurrency } from "@/core/ui/amount-format";
import { ROW_ACTION_ICON_SIZE, SPACING } from "@/core/ui/theme";

import { KIND_SECTION_LABELS, templateLineSections } from "../template-vm";

interface TemplateLinesProps {
  lines: TemplateLine[];
  currency: SupportedCurrency;
  isDeleting: boolean;
  onEdit: (line: TemplateLine) => void;
  onDelete: (line: TemplateLine) => void;
}

/** The model's forecasts, grouped by nature — income first, then what leaves. */
export function TemplateLines({
  lines,
  currency,
  isDeleting,
  onEdit,
  onDelete,
}: TemplateLinesProps) {
  return (
    <>
      {templateLineSections(lines).map((section) => (
        <View key={section.kind} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleSmall">
              {KIND_SECTION_LABELS[section.kind]}
            </Text>
            <Amount size="meta" tone="muted">
              {/* Compact: the section total restates the summary card above,
                  which rounds — printing centimes here made one number look
                  like two. The lines below keep theirs; they are edited. */}
              {formatCompactCurrency(section.total, currency)}
            </Amount>
          </View>

          <Card mode="contained">
            <Card.Content style={styles.card}>
              {section.lines.map((line, index) => (
                <View key={line.id}>
                  {index > 0 && <Divider />}
                  <LineRow
                    line={line}
                    currency={currency}
                    isDeleting={isDeleting}
                    onEdit={() => onEdit(line)}
                    onDelete={() => onDelete(line)}
                  />
                </View>
              ))}
            </Card.Content>
          </Card>
        </View>
      ))}
    </>
  );
}

function LineRow({
  line,
  currency,
  isDeleting,
  onEdit,
  onDelete,
}: {
  line: TemplateLine;
  currency: SupportedCurrency;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const financial = useFinancialColors();
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {recurrenceLabel(t, line.recurrence)}
        </Text>
        <Text variant="bodyLarge" numberOfLines={1}>
          {line.name}
        </Text>
      </View>

      <Amount
        size="meta"
        style={{
          color:
            line.kind === "income" ? financial.income : theme.colors.onSurface,
        }}
      >
        {formatCurrency(line.amount, currency)}
      </Amount>

      <IconButton
        icon="pencil-outline"
        size={ROW_ACTION_ICON_SIZE}
        style={styles.action}
        onPress={onEdit}
        accessibilityLabel={`Modifier ${line.name}`}
      />
      <IconButton
        icon="trash-can-outline"
        size={ROW_ACTION_ICON_SIZE}
        style={styles.action}
        onPress={onDelete}
        disabled={isDeleting}
        accessibilityLabel={`Supprimer ${line.name}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  card: { paddingVertical: SPACING.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.xxs,
  },
  labels: { flex: 1, gap: SPACING.xxs },
  action: { margin: 0 },
});
