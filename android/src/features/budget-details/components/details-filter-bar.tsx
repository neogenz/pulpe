import { ScrollView, StyleSheet, View } from "react-native";
import { Chip, SegmentedButtons } from "react-native-paper";

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
}

/**
 * The two questions the screen answers: "which nature?" and "what is left to
 * do?". The kind counts are computed against the checked filter already in
 * force, so a chip reading zero is telling the truth about what tapping it
 * would show.
 *
 * Searching is not one of these rows. It takes over the app bar instead, which
 * is where Android puts it — a field that appeared between the hero and the
 * filters pushed the first line of data off the screen and read as a bug.
 */
export function DetailsFilterBar({
  filters,
  counts,
  onChange,
}: DetailsFilterBarProps) {
  return (
    <View style={styles.bar}>
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

  gutter: { paddingHorizontal: SCREEN_PADDING },
  // The rail runs edge to edge and carries the gutter as content padding, so
  // the first and last chip scroll past it rather than being clipped by it.
  chips: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SCREEN_PADDING,
  },
});
