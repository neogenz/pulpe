import type { SupportedCurrency, TemplateLine } from "pulpe-shared";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Card, Divider, IconButton, Text, useTheme } from "react-native-paper";

import { formatCurrency } from "@/core/ui/amount-format";
import { FINANCIAL_COLORS, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

import { KIND_SECTION_LABELS, templateLineSections } from "../template-vm";

const RECURRENCE_LABELS = {
  fixed: "Récurrent",
  one_off: "Prévu",
} as const;

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
  const theme = useTheme();

  return (
    <>
      {templateLineSections(lines).map((section) => (
        <View key={section.kind} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleSmall">
              {KIND_SECTION_LABELS[section.kind]}
            </Text>
            <Text
              variant="labelLarge"
              style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
            >
              {formatCurrency(section.total, currency)}
            </Text>
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
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {RECURRENCE_LABELS[line.recurrence]}
        </Text>
        <Text variant="bodyLarge" numberOfLines={1}>
          {line.name}
        </Text>
      </View>

      <Text
        variant="labelLarge"
        style={[
          TABULAR_DIGITS,
          {
            color:
              line.kind === "income"
                ? FINANCIAL_COLORS[scheme].income
                : theme.colors.onSurface,
          },
        ]}
      >
        {formatCurrency(line.amount, currency)}
      </Text>

      <IconButton
        icon="pencil-outline"
        onPress={onEdit}
        accessibilityLabel={`Modifier ${line.name}`}
      />
      <IconButton
        icon="trash-can-outline"
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
});
