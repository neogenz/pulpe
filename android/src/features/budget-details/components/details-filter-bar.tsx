import { ScrollView, StyleSheet, View } from "react-native";
import { Chip, SegmentedButtons, Searchbar } from "react-native-paper";

import { SPACING } from "@/core/ui/theme";

import type {
  CheckedFilter,
  DetailsFilters,
  KindCounts,
  KindFilter,
} from "../budget-details-selectors";

const KIND_CHIPS: {
  key: KindFilter;
  label: string;
  count: keyof KindCounts;
}[] = [
  { key: "all", label: "Tout", count: "all" },
  { key: "income", label: "Revenus", count: "income" },
  { key: "saving", label: "Épargne", count: "saving" },
  { key: "expense", label: "Dépenses", count: "expense" },
];

const CHECKED_OPTIONS: { value: CheckedFilter; label: string }[] = [
  { value: "unchecked", label: "À pointer" },
  { value: "checked", label: "Pointé" },
  { value: "all", label: "Tout" },
];

interface DetailsFilterBarProps {
  filters: DetailsFilters;
  counts: KindCounts;
  onChange: (filters: DetailsFilters) => void;
}

/**
 * The two questions the screen answers — "which nature?" and "what is left to
 * do?" — plus the search. The kind counts are computed against the checked
 * filter already in force, so a chip reading zero is telling the truth about
 * what tapping it would show.
 */
export function DetailsFilterBar({
  filters,
  counts,
  onChange,
}: DetailsFilterBarProps) {
  return (
    <View style={styles.bar}>
      <Searchbar
        placeholder="Rechercher"
        value={filters.search}
        onChangeText={(search) => onChange({ ...filters, search })}
        mode="view"
        style={styles.search}
      />

      <SegmentedButtons
        value={filters.checked}
        onValueChange={(checked) =>
          onChange({ ...filters, checked: checked as CheckedFilter })
        }
        buttons={CHECKED_OPTIONS}
        density="small"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {KIND_CHIPS.map((chip) => (
          <Chip
            key={chip.key}
            selected={filters.kind === chip.key}
            showSelectedCheck={false}
            onPress={() => onChange({ ...filters, kind: chip.key })}
            compact
          >
            {`${chip.label} ${counts[chip.count]}`}
          </Chip>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: SPACING.sm },
  search: { borderRadius: SPACING.sm },
  chips: { flexDirection: "row", gap: SPACING.sm },
});
