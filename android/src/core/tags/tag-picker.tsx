import { MAX_TAGS_PER_TRANSACTION } from "pulpe-shared";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Chip,
  HelperText,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { SPACING } from "@/core/ui/theme";

import { useCreateTag, useTags } from "./tag-queries";
import { canCreateTag, tagNameIssue, toggledTagIds } from "./tag-selection";

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
          the bottom of the sheet. */}
      {tags.isPending ? (
        <ActivityIndicator />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chips}
        >
          {available.map((tag) => {
            const isSelected = selectedIds.includes(tag.id);
            return (
              <Chip
                key={tag.id}
                selected={isSelected}
                showSelectedCheck={false}
                icon={isSelected ? "check" : "tag-outline"}
                disabled={
                  !isSelected && selectedIds.length >= MAX_TAGS_PER_TRANSACTION
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
        </ScrollView>
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
  chips: { flexDirection: "row", gap: SPACING.xs, paddingRight: SPACING.md },
  create: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  nameField: { flex: 1 },
  creating: { marginHorizontal: SPACING.md },
});
