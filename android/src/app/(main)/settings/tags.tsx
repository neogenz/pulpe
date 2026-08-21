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
import { useTranslation } from "@/core/i18n/locale-store";
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
import { TAG_NAME_MAX_LENGTH } from "@/features/tags/tag-selection";

/** `tagCreateSchema` caps a name at 30 characters. */
/**
 * Personal tags, editable here rather than read-only as on iOS: this is the
 * only surface either mobile app offers for them, and a tag that can be
 * created but never renamed or removed accumulates typos forever.
 */
export default function TagsSettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
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
  const hasLoadError = tags.isError && tags.data === undefined;

  function submitDraft() {
    const name = draftName.trim();
    if (name.length === 0 || create.isPending || hasLoadError) return;

    create.mutate(name, { onSuccess: () => setDraftName("") });
  }

  function startRename(tag: Tag) {
    rename.reset();
    setRenamedTag(tag);
    setRenamedName(tag.name);
  }

  function startDelete(tag: Tag) {
    remove.reset();
    setDeletedTag(tag);
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={t("settings.tags.title")} />
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
          {t("settings.tags.description")}
        </Text>

        <View style={styles.addRow}>
          <TextInput
            mode="outlined"
            label={t("settings.tags.newTag")}
            value={draftName}
            onChangeText={setDraftName}
            maxLength={TAG_NAME_MAX_LENGTH}
            style={styles.addInput}
            onSubmitEditing={submitDraft}
            returnKeyType="done"
          />
          <Button
            mode="contained"
            onPress={submitDraft}
            disabled={
              draftName.trim().length === 0 || create.isPending || hasLoadError
            }
            loading={create.isPending}
          >
            {t("settings.tags.add")}
          </Button>
        </View>

        {create.isError && (
          <FieldError visible>{t("settings.tags.createError")}</FieldError>
        )}

        {tags.isPending ? (
          <ActivityIndicator accessibilityLabel={t("common.loading")} />
        ) : hasLoadError ? (
          <View style={styles.loadError}>
            <FieldError visible>{t("settings.tags.loadError")}</FieldError>
            <Button onPress={() => void tags.refetch()}>
              {t("common.retry")}
            </Button>
          </View>
        ) : list.length === 0 ? (
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("settings.tags.empty")}
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
                      accessibilityLabel={t("settings.tags.renameA11y", {
                        name: tag.name,
                      })}
                    />
                    <IconButton
                      icon="delete-outline"
                      size={ROW_ACTION_ICON_SIZE}
                      style={styles.action}
                      onPress={() => startDelete(tag)}
                      accessibilityLabel={t("settings.tags.deleteA11y", {
                        name: tag.name,
                      })}
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
          onDismiss={() => {
            if (!rename.isPending) setRenamedTag(null);
          }}
        >
          <Dialog.Title>{t("settings.tags.renameTitle")}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label={t("settings.tags.name")}
              value={renamedName}
              onChangeText={setRenamedName}
              maxLength={TAG_NAME_MAX_LENGTH}
              autoFocus
            />
            {rename.isError && (
              <FieldError visible>{t("settings.tags.renameError")}</FieldError>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setRenamedTag(null)}
              disabled={rename.isPending}
            >
              {t("common.cancel")}
            </Button>
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
              {t("settings.tags.rename")}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={deletedTag !== null}
          onDismiss={() => {
            if (!remove.isPending) setDeletedTag(null);
          }}
        >
          <Dialog.Title>{t("settings.tags.deleteTitle")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t("settings.tags.deleteDescription", {
                name: deletedTag?.name ?? "",
              })}
            </Text>
            {remove.isError && (
              <FieldError visible>{t("settings.tags.deleteError")}</FieldError>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setDeletedTag(null)}
              disabled={remove.isPending}
            >
              {t("common.cancel")}
            </Button>
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
              {t("settings.tags.delete")}
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
  loadError: { alignItems: "flex-start" },
});
