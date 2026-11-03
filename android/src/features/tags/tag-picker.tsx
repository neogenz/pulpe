import { MAX_TAGS_PER_TRANSACTION } from "pulpe-shared";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Chip,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { FadingRail } from "@/core/ui/fading-rail";
import { useTranslation } from "@/core/i18n/locale-store";
import { FilterChip } from "@/core/ui/filter-chip";
import { SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";
import { useRevealInSheet } from "@/core/ui/sheet";

import { useCreateTag, useTags } from "./tag-queries";
import {
  canCreateTag,
  findTagByName,
  TAG_NAME_MAX_LENGTH,
  tagNameIssue,
  tagsMatching,
  tagsSelectedFirst,
  toggledTagIds,
} from "./tag-selection";

/** The gutter `core/ui/sheet` keeps, and so the one the rail has to give back. */
const SHEET_PADDING = SPACING.lg;

interface TagPickerProps {
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
}

/**
 * Up to ten tags, found or created from one field. Typing narrows the row to
 * the tags that match; when none carries that exact name, the row offers to
 * create it. Picking or creating a tag selects it and clears the field, so the
 * whole row is back for the next one.
 */
export function TagPicker({ selectedIds, onChange }: TagPickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const tags = useTags();
  const createTag = useCreateTag();
  const [query, setQuery] = useState("");
  const field = useRef<View>(null);
  const revealInSheet = useRevealInSheet();

  const available = tags.data ?? [];
  const hasLoadError = tags.isError && tags.data === undefined;
  const matches = tagsMatching(
    query,
    tagsSelectedFirst(available, selectedIds),
  );
  const exactMatch = findTagByName(query, available);
  // An exact match is the answer, not a mistake: the tag is right there in the row.
  const issue = exactMatch
    ? null
    : tagNameIssue(query, available, selectedIds.length);
  const offersCreation =
    canCreateTag(query, available, selectedIds.length) && !hasLoadError;

  function pick(tagId: string) {
    onChange(toggledTagIds(tagId, selectedIds));
    setQuery("");
  }

  function create() {
    if (!offersCreation || createTag.isPending) return;
    const name = query.trim();
    createTag.mutate(name, {
      onSuccess: (tag) => {
        onChange(toggledTagIds(tag.id, selectedIds));
        // The field stays live during the request: keep anything typed after the submit.
        setQuery((current) => (current.trim() === name ? "" : current));
      },
    });
  }

  /** The keyboard's return key takes the tag of that exact name, or creates it. */
  function submit() {
    if (exactMatch === undefined) {
      create();
    } else if (selectedIds.includes(exactMatch.id)) {
      setQuery("");
    } else {
      pick(exactMatch.id);
    }
  }

  return (
    <View ref={field} style={styles.field}>
      <View style={styles.heading}>
        <Text variant="labelLarge">{t("settings.tags.pickerTitle")}</Text>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("settings.tags.selectionCount", {
            count: selectedIds.length,
            total: MAX_TAGS_PER_TRANSACTION,
          })}
        </Text>
      </View>

      {tags.isPending ? (
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      ) : hasLoadError ? (
        <View style={styles.errorState}>
          <FieldError visible>{t("settings.tags.loadError")}</FieldError>
          <IconButton
            icon="refresh"
            onPress={() => void tags.refetch()}
            accessibilityLabel={t("common.retry")}
          />
        </View>
      ) : (
        <>
          <TextInput
            mode="outlined"
            dense
            placeholder={t("settings.tags.searchOrCreate")}
            accessibilityLabel={t("settings.tags.searchOrCreate")}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submit}
            // The matches sit under the field, where the keyboard would hide them.
            onFocus={() => revealInSheet(field.current)}
            onBlur={() => revealInSheet(null)}
            // Several tags in a row is the common case: the keyboard stays up.
            submitBehavior="submit"
            returnKeyType="done"
            left={<TextInput.Icon icon="magnify" />}
            right={
              query.length > 0 ? (
                <TextInput.Icon
                  icon="close-circle"
                  onPress={() => setQuery("")}
                  accessibilityLabel={t("common.clear")}
                />
              ) : undefined
            }
          />

          {/* One scrolling row, not a wrapping wall: sixteen tags stacked into
              six rows pushed the rest of the form — the submit button included —
              off the bottom of the sheet. It runs to the sheet's own edges so a
              chip scrolls past the gutter instead of being clipped by it. */}
          {(offersCreation || matches.length > 0) && (
            <View style={styles.rail}>
              <FadingRail
                inset={SHEET_PADDING}
                background={theme.colors.surface}
                accessibilityLabel={t("settings.tags.available")}
              >
                {matches.map((tag) => {
                  const isSelected = selectedIds.includes(tag.id);
                  return (
                    <FilterChip
                      key={tag.id}
                      selected={isSelected}
                      icon={isSelected ? "check" : "tag-outline"}
                      // Held while a tag is created: its success adds to the
                      // selection it captured, and would undo a chip toggled
                      // meanwhile.
                      disabled={
                        createTag.isPending ||
                        (!isSelected &&
                          selectedIds.length >= MAX_TAGS_PER_TRANSACTION)
                      }
                      onPress={() => pick(tag.id)}
                      accessibilityState={{ selected: isSelected }}
                    >
                      {tag.name}
                    </FilterChip>
                  );
                })}
                {/* After the matches: on a partial match the existing tag is the
                    likelier intent, and it stays the first chip under the thumb. */}
                {offersCreation &&
                  (createTag.isPending ? (
                    <ActivityIndicator
                      style={styles.creating}
                      accessibilityLabel={t("common.loading")}
                    />
                  ) : (
                    <Chip icon="plus" onPress={create}>
                      {t("settings.tags.createNamed", { name: query.trim() })}
                    </Chip>
                  ))}
              </FadingRail>
            </View>
          )}
        </>
      )}

      {issue !== null && !hasLoadError && (
        <FieldError visible>
          {t(`settings.tags.validation.${issue}`, {
            count:
              issue === "tooLong"
                ? TAG_NAME_MAX_LENGTH
                : MAX_TAGS_PER_TRANSACTION,
          })}
        </FieldError>
      )}
      {createTag.isError && (
        <FieldError visible>{t("settings.tags.createError")}</FieldError>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: SPACING.sm },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rail: { marginHorizontal: -SHEET_PADDING },
  creating: { marginHorizontal: SPACING.md },
  errorState: { flexDirection: "row", alignItems: "center" },
});
