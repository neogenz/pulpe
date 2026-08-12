import { ScrollView, StyleSheet, View } from "react-native";
import { Chip, SegmentedButtons, Searchbar } from "react-native-paper";

import { SCREEN_PADDING, SPACING } from "@/core/ui/theme";

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
  /** Raised from the app bar's magnifier, the way Android hides a search. */
  isSearchVisible: boolean;
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
  isSearchVisible,
}: DetailsFilterBarProps) {
  return (
    <View style={styles.bar}>
      {/* A permanent search field cost a full row on a screen whose first line
          of data already sat two thirds of the way down. It comes out of the
          app bar now, and only when asked for. */}
      {isSearchVisible && (
        <Searchbar
          placeholder="Rechercher"
          value={filters.search}
          onChangeText={(search) => onChange({ ...filters, search })}
          mode="view"
          autoFocus
          style={[styles.search, styles.gutter]}
        />
      )}

      <View style={styles.gutter}>
        <SegmentedButtons
          value={filters.checked}
          onValueChange={(checked) =>
            onChange({ ...filters, checked: checked as CheckedFilter })
          }
          buttons={CHECKED_OPTIONS}
          density="small"
        />
      </View>

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
  gutter: { paddingHorizontal: SCREEN_PADDING },
  // The rail runs edge to edge and carries the gutter as content padding, so
  // the first and last chip scroll past it rather than being clipped by it.
  chips: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SCREEN_PADDING,
  },
});
