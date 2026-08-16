import type { SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import {
  IconButton,
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";

import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { FilterChip } from "@/core/ui/filter-chip";
import { SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

import {
  MAX_SPREAD_MONTHS,
  type SpreadMode,
  type SpreadMonthCell,
  spreadCounterpart,
  spreadWindowProblem,
} from "../spread-window";

const MODE_BUTTONS: { value: SpreadMode; label: string }[] = [
  { value: "total", label: "Total à répartir" },
  { value: "perMonth", label: "Montant par mois" },
];

interface SpreadFormSectionProps {
  cells: SpreadMonthCell[];
  mode: SpreadMode;
  amount: number | null;
  currency: SupportedCurrency;
  minimumMonths: number;
  /** Absent when the window's length is fixed, as when spreading an existing line. */
  onChangeMode?: (mode: SpreadMode) => void;
  onChangeLength: (length: number) => void;
  onToggleMonth: (key: string) => void;
}

/**
 * The window a spread covers, and what each of its months will carry.
 *
 * The amounts shown here are the amounts that get written: `total` runs through
 * the same splitter the server uses, so the preview cannot drift from the
 * result. Tapping a month out is what makes "January through June, but not
 * March" sayable.
 */
export function SpreadFormSection({
  cells,
  mode,
  amount,
  currency,
  minimumMonths,
  onChangeMode,
  onChangeLength,
  onToggleMonth,
}: SpreadFormSectionProps) {
  const theme = useTheme();
  const selectedCount = cells.filter((cell) => cell.isSelected).length;
  const problem = spreadWindowProblem(cells, minimumMonths);
  const counterpart =
    amount === null ? 0 : spreadCounterpart(mode, amount, selectedCount);

  return (
    <View style={styles.section}>
      {onChangeMode !== undefined && (
        <SegmentedButtons
          value={mode}
          onValueChange={(next) => onChangeMode(next as SpreadMode)}
          buttons={MODE_BUTTONS}
        />
      )}

      <View style={styles.lengthRow}>
        <Text variant="bodyLarge" style={styles.lengthLabel}>
          {cells.length} mois
        </Text>
        <IconButton
          icon="minus"
          mode="outlined"
          disabled={cells.length <= minimumMonths}
          onPress={() => onChangeLength(cells.length - 1)}
          accessibilityLabel="Un mois de moins"
        />
        <IconButton
          icon="plus"
          mode="outlined"
          disabled={cells.length >= MAX_SPREAD_MONTHS}
          onPress={() => onChangeLength(cells.length + 1)}
          accessibilityLabel="Un mois de plus"
        />
      </View>

      <View style={styles.months}>
        {cells.map((cell) => (
          <FilterChip
            key={cell.key}
            selected={cell.isSelected}
            onPress={() => onToggleMonth(cell.key)}
            textStyle={styles.month}
          >
            {formatMonthName(cell.month, cell.year)}
          </FilterChip>
        ))}
      </View>

      {problem === null ? (
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {amount === null
            ? `Réparti sur ${selectedCount} mois`
            : mode === "total"
              ? `≈ ${formatCurrency(counterpart, currency)} par mois sur ${selectedCount} mois`
              : `${formatCurrency(counterpart, currency)} au total sur ${selectedCount} mois`}
        </Text>
      ) : (
        <FieldError visible>{problem}</FieldError>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm },
  lengthRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  lengthLabel: { flex: 1 },
  months: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  month: { textTransform: "capitalize" },
});
