import { MAX_TAGS_PER_TRANSACTION } from "pulpe-shared";
import { useState } from "react";
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

import { useCreateTag, useTags } from "./tag-queries";
import {
  canCreateTag,
  TAG_NAME_MAX_LENGTH,
  tagNameIssue,
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
 * Up to ten tags, chosen from the user's own list or created on the spot. A new
 * tag is selected the moment it exists — creating one and then having to find
 * it in the list would be a second step for a decision already made.
 */
export function TagPicker({ selectedIds, onChange }: TagPickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const tags = useTags();
  const createTag = useCreateTag();
  const [name, setName] = useState("");
  const [isCreating, setCreating] = useState(false);

  const available = tags.data ?? [];
  const hasLoadError = tags.isError && tags.data === undefined;
  const ordered = tagsSelectedFirst(available, selectedIds);
  const issue = tagNameIssue(name, available, selectedIds.length);
  const isCreatable =
    canCreateTag(name, available, selectedIds.length) &&
    !createTag.isPending &&
    !hasLoadError;

  function create() {
    if (!isCreatable) return;
    createTag.mutate(name.trim(), {
      onSuccess: (tag) => {
        onChange(toggledTagIds(tag.id, selectedIds));
        setName("");
      },
    });
  }

  return (
    <View style={styles.field}>
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

      {/* One scrolling row, not a wrapping wall: sixteen tags stacked into six
          rows pushed the rest of the form — the submit button included — off
          the bottom of the sheet. It runs to the sheet's own edges so a chip
          scrolls past the gutter instead of being clipped by it. */}
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
        <View style={styles.rail}>
          <FadingRail
            inset={SHEET_PADDING}
            background={theme.colors.surface}
            accessibilityLabel={t("settings.tags.available")}
          >
            {ordered.map((tag) => {
              const isSelected = selectedIds.includes(tag.id);
              return (
                <FilterChip
                  key={tag.id}
                  selected={isSelected}
                  icon={isSelected ? "check" : "tag-outline"}
                  disabled={
                    !isSelected &&
                    selectedIds.length >= MAX_TAGS_PER_TRANSACTION
                  }
                  onPress={() => onChange(toggledTagIds(tag.id, selectedIds))}
                  accessibilityState={{ selected: isSelected }}
                >
                  {tag.name}
                </FilterChip>
              );
            })}

            {/* Creating a tag is the rare act, so it costs a tap rather than a
                permanent field sitting under every list. */}
            {!isCreating && (
              <Chip icon="plus" onPress={() => setCreating(true)}>
                {t("settings.tags.new")}
              </Chip>
            )}
          </FadingRail>
        </View>
      )}

      {isCreating && !hasLoadError && (
        <View style={styles.create}>
          <TextInput
            mode="outlined"
            dense
            autoFocus
            label={t("settings.tags.newTag")}
            value={name}
            onChangeText={setName}
            onSubmitEditing={create}
            returnKeyType="done"
            style={styles.nameField}
          />
          {createTag.isPending ? (
            <ActivityIndicator
              style={styles.creating}
              accessibilityLabel={t("common.loading")}
            />
          ) : (
            <IconButton
              icon="plus"
              mode="contained-tonal"
              disabled={!isCreatable}
              onPress={create}
              accessibilityLabel={t("settings.tags.createSelect")}
            />
          )}
        </View>
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
  create: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  nameField: { flex: 1 },
  creating: { marginHorizontal: SPACING.md },
  errorState: { flexDirection: "row", alignItems: "center" },
});
