import { router } from "expo-router";
import type { Tag } from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Dialog,
  IconButton,
  List,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/core/ui/card";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";

import {
  useCreateTag,
  useDeleteTag,
  useRenameTag,
  useTags,
} from "@/features/tags/tag-queries";
import { useKeyboardHeight } from "@/core/ui/keyboard-inset";
import { ROW_ACTION_ICON_SIZE, SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

/** `tagCreateSchema` caps a name at 30 characters. */
const NAME_MAX_LENGTH = 30;

/**
 * Personal tags, editable here rather than read-only as on iOS: this is the
 * only surface either mobile app offers for them, and a tag that can be
 * created but never renamed or removed accumulates typos forever.
 */
export default function TagsSettingsScreen() {
  const theme = useTheme();
  const keyboardHeight = useKeyboardHeight();
  const tags = useTags();
  const create = useCreateTag();
  const rename = useRenameTag();
  const remove = useDeleteTag();
  const [draftName, setDraftName] = useState("");
  const [renamedTag, setRenamedTag] = useState<Tag | null>(null);
  const [renamedName, setRenamedName] = useState("");
  const [deletedTag, setDeletedTag] = useState<Tag | null>(null);

  const list = tags.data ?? [];

  function submitDraft() {
    const name = draftName.trim();
    if (name.length === 0 || create.isPending) return;

    create.mutate(name, { onSuccess: () => setDraftName("") });
  }

  function startRename(tag: Tag) {
    setRenamedTag(tag);
    setRenamedName(tag.name);
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Mes tags" />
      </ScreenAppBar>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SPACING.xxl + keyboardHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={tags.isRefetching}
            onRefresh={() => void tags.refetch()}
          />
        }
      >
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          Tes tags servent à regrouper des prévisions et des opérations. Ils
          sont partagés avec le web et l&apos;app iOS.
        </Text>

        <View style={styles.addRow}>
          <TextInput
            mode="outlined"
            label="Nouveau tag"
            value={draftName}
            onChangeText={setDraftName}
            maxLength={NAME_MAX_LENGTH}
            style={styles.addInput}
            onSubmitEditing={submitDraft}
            returnKeyType="done"
          />
          <Button
            mode="contained"
            onPress={submitDraft}
            disabled={draftName.trim().length === 0 || create.isPending}
            loading={create.isPending}
          >
            Ajouter
          </Button>
        </View>

        {create.isError && (
          <FieldError visible>
            Le tag n&apos;a pas pu être créé. Il existe peut-être déjà.
          </FieldError>
        )}

        {tags.isPending ? (
          <ActivityIndicator accessibilityLabel="Chargement" />
        ) : list.length === 0 ? (
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Aucun tag pour l&apos;instant.
          </Text>
        ) : (
          <Card mode="contained">
            {list.map((tag) => (
              <List.Item
                key={tag.id}
                title={tag.name}
                left={(props) => <List.Icon {...props} icon="tag-outline" />}
                right={() => (
                  <View style={styles.actions}>
                    <IconButton
                      icon="pencil-outline"
                      size={ROW_ACTION_ICON_SIZE}
                      style={styles.action}
                      onPress={() => startRename(tag)}
                      accessibilityLabel={`Renommer ${tag.name}`}
                    />
                    <IconButton
                      icon="delete-outline"
                      size={ROW_ACTION_ICON_SIZE}
                      style={styles.action}
                      onPress={() => setDeletedTag(tag)}
                      accessibilityLabel={`Supprimer ${tag.name}`}
                    />
                  </View>
                )}
              />
            ))}
          </Card>
        )}
      </ScrollView>

      <Portal>
        <Dialog
          visible={renamedTag !== null}
          onDismiss={() => setRenamedTag(null)}
        >
          <Dialog.Title>Renommer le tag</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Nom"
              value={renamedName}
              onChangeText={setRenamedName}
              maxLength={NAME_MAX_LENGTH}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenamedTag(null)}>Annuler</Button>
            <Button
              disabled={renamedName.trim().length === 0 || rename.isPending}
              loading={rename.isPending}
              onPress={() => {
                if (renamedTag === null) return;
                rename.mutate(
                  { tagId: renamedTag.id, name: renamedName.trim() },
                  { onSuccess: () => setRenamedTag(null) },
                );
              }}
            >
              Renommer
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={deletedTag !== null}
          onDismiss={() => setDeletedTag(null)}
        >
          <Dialog.Title>Supprimer ce tag ?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              «&nbsp;{deletedTag?.name}&nbsp;» sera retiré des prévisions et des
              opérations qui le portent. Elles, elles restent.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeletedTag(null)}>Annuler</Button>
            <Button
              textColor={theme.colors.error}
              disabled={remove.isPending}
              loading={remove.isPending}
              onPress={() => {
                if (deletedTag === null) return;
                remove.mutate(deletedTag.id, {
                  onSuccess: () => setDeletedTag(null),
                });
              }}
            >
              Supprimer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  addRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  addInput: { flex: 1 },
  actions: { flexDirection: "row", alignItems: "center" },
  action: { margin: 0 },
});
