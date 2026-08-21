import { StyleSheet, View } from "react-native";
import { SegmentedButtons } from "react-native-paper";

import { FadingRail } from "@/core/ui/fading-rail";
import { FilterChip } from "@/core/ui/filter-chip";
import { useTranslation } from "@/core/i18n/locale-store";
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
  { key: "all", label: "all", count: "all" },
  { key: "income", label: "income", count: "income" },
  { key: "saving", label: "saving", count: "saving" },
  { key: "expense", label: "expense", count: "expense" },
];

const CHECKED_OPTIONS: { value: CheckedFilter; label: string }[] = [
  { value: "unchecked", label: "unchecked" },
  { value: "checked", label: "checked" },
  { value: "all", label: "all" },
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
  const { t } = useTranslation();
  return (
    <View style={styles.bar}>
      <View style={styles.gutter}>
        <SegmentedButtons
          value={filters.checked}
          onValueChange={(checked) =>
            onChange({ ...filters, checked: checked as CheckedFilter })
          }
          buttons={CHECKED_OPTIONS.map((option) => ({
            ...option,
            label: t(`budgets.detail.filters.${option.label}`),
          }))}
          density="small"
        />
      </View>

      <FadingRail>
        {KIND_CHIPS.map((chip) => (
          <FilterChip
            key={chip.key}
            selected={filters.kind === chip.key}
            onPress={() => onChange({ ...filters, kind: chip.key })}
            compact
          >
            {`${t(`budgets.detail.filters.${chip.label}`)} ${counts[chip.count]}`}
          </FilterChip>
        ))}
      </FadingRail>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: SPACING.sm },
  gutter: { paddingHorizontal: SCREEN_PADDING },
});
