import { MAX_TAGS_PER_TRANSACTION } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Chip,
  HelperText,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { FadingRail } from "@/core/ui/fading-rail";
import { SPACING } from "@/core/ui/theme";

import { useCreateTag, useTags } from "./tag-queries";
import {
  canCreateTag,
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
  const tags = useTags();
  const createTag = useCreateTag();
  const [name, setName] = useState("");
  const [isCreating, setCreating] = useState(false);

  const available = tags.data ?? [];
  const ordered = tagsSelectedFirst(available, selectedIds);
  const issue = tagNameIssue(name, available, selectedIds.length);
  const isCreatable =
    canCreateTag(name, available, selectedIds.length) && !createTag.isPending;

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
        <Text variant="labelLarge">Tags</Text>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {`${selectedIds.length} sur ${MAX_TAGS_PER_TRANSACTION}`}
        </Text>
      </View>

      {/* One scrolling row, not a wrapping wall: sixteen tags stacked into six
          rows pushed the rest of the form — the submit button included — off
          the bottom of the sheet. It runs to the sheet's own edges so a chip
          scrolls past the gutter instead of being clipped by it. */}
      {tags.isPending ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.rail}>
          <FadingRail
            inset={SHEET_PADDING}
            background={theme.colors.surface}
            accessibilityLabel="Tags disponibles"
          >
            {ordered.map((tag) => {
              const isSelected = selectedIds.includes(tag.id);
              return (
                <Chip
                  key={tag.id}
                  selected={isSelected}
                  showSelectedCheck={false}
                  icon={isSelected ? "check" : "tag-outline"}
                  disabled={
                    !isSelected &&
                    selectedIds.length >= MAX_TAGS_PER_TRANSACTION
                  }
                  onPress={() => onChange(toggledTagIds(tag.id, selectedIds))}
                  accessibilityState={{ selected: isSelected }}
                >
                  {tag.name}
                </Chip>
              );
            })}

            {/* Creating a tag is the rare act, so it costs a tap rather than a
                permanent field sitting under every list. */}
            {!isCreating && (
              <Chip icon="plus" onPress={() => setCreating(true)}>
                Nouveau
              </Chip>
            )}
          </FadingRail>
        </View>
      )}

      {isCreating && (
        <View style={styles.create}>
          <TextInput
            mode="outlined"
            dense
            autoFocus
            label="Nouveau tag"
            value={name}
            onChangeText={setName}
            onSubmitEditing={create}
            returnKeyType="done"
            style={styles.nameField}
          />
          {createTag.isPending ? (
            <ActivityIndicator style={styles.creating} />
          ) : (
            <IconButton
              icon="plus"
              mode="contained-tonal"
              disabled={!isCreatable}
              onPress={create}
              accessibilityLabel="Créer et sélectionner ce tag"
            />
          )}
        </View>
      )}

      {issue !== null && (
        <HelperText type="error" visible>
          {issue}
        </HelperText>
      )}
      {createTag.isError && (
        <HelperText type="error" visible>
          Le tag n&apos;a pas pu être créé. Réessaie.
        </HelperText>
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
});
