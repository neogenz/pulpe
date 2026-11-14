import { StyleSheet, View } from "react-native";

import { FadingRail } from "@/core/ui/fading-rail";
import { FilterChip } from "@/core/ui/filter-chip";
import { useTranslation } from "@/core/i18n/locale-store";
import { SPACING } from "@/core/ui/theme";

import type {
  CheckedCounts,
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

/** « Pointé » stays reachable as the last chip; the three before it are iOS's rail. */
const CHECKED_CHIPS: { key: CheckedFilter; count?: keyof CheckedCounts }[] = [
  { key: "all" },
  { key: "unchecked", count: "unchecked" },
  { key: "over", count: "over" },
  { key: "checked" },
];

interface DetailsFilterBarProps {
  filters: DetailsFilters;
  counts: KindCounts;
  checkedCounts: CheckedCounts;
  /** A month that has not started has nothing to point or overrun yet. */
  hideChecked: boolean;
  onChange: (filters: DetailsFilters) => void;
}

/**
 * The two questions the screen answers: "what is left to do?" and "which
 * nature?". Each count is computed against the other filter already in force,
 * so a chip reading zero is telling the truth about what tapping it would show.
 *
 * Searching is not one of these rows. It takes over the app bar instead, which
 * is where Android puts it — a field that appeared between the hero and the
 * filters pushed the first line of data off the screen and read as a bug.
 */
export function DetailsFilterBar({
  filters,
  counts,
  checkedCounts,
  hideChecked,
  onChange,
}: DetailsFilterBarProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.bar}>
      {!hideChecked && (
        <FadingRail>
          {CHECKED_CHIPS.map((chip) => (
            <FilterChip
              key={chip.key}
              selected={filters.checked === chip.key}
              onPress={() => onChange({ ...filters, checked: chip.key })}
              compact
            >
              {chip.count === undefined
                ? t(`budgets.detail.filters.${chip.key}`)
                : `${t(`budgets.detail.filters.${chip.key}`)} ${checkedCounts[chip.count]}`}
            </FilterChip>
          ))}
        </FadingRail>
      )}

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
});
