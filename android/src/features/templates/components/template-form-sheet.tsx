import type { BudgetTemplate } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Switch, Text, TextInput, useTheme } from "react-native-paper";

import { hapticSuccess } from "@/core/ui/haptics";
import { useTranslation } from "@/core/i18n/locale-store";
import { Sheet } from "@/core/ui/sheet";
import { SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

import { useCreateTemplate, useUpdateTemplate } from "../template-queries";

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;

interface TemplateFormSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  /** Absent when creating; the model being renamed otherwise. */
  template?: BudgetTemplate;
  onSaved: (template: BudgetTemplate) => void;
}

/**
 * A model's identity: what it is called, what it is for, and whether new months
 * start from it.
 *
 * Departure from iOS, which collects the first forecasts in the same form: here
 * a model is created empty and filled from its own screen, where the lines
 * already have an editor, a propagation prompt and a bulk bar. Asking the same
 * questions twice would have meant two forms drifting apart.
 */
export function TemplateFormSheet({
  isVisible,
  onDismiss,
  template,
  onSaved,
}: TemplateFormSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [isDefault, setDefault] = useState(template?.isDefault ?? false);

  const isEditing = template !== undefined;
  const mutation = isEditing ? update : create;
  const isSubmittable = name.trim().length > 0 && !mutation.isPending;

  function dismiss() {
    setName(template?.name ?? "");
    setDescription(template?.description ?? "");
    setDefault(template?.isDefault ?? false);
    create.reset();
    update.reset();
    onDismiss();
  }

  function submit() {
    if (!isSubmittable) return;

    const onSuccess = (saved: BudgetTemplate) => {
      hapticSuccess();
      onSaved(saved);
    };
    const trimmed = description.trim();

    if (template === undefined) {
      create.mutate(
        {
          name: name.trim(),
          isDefault,
          lines: [],
          ...(trimmed.length > 0 ? { description: trimmed } : {}),
        },
        { onSuccess },
      );
      return;
    }
    update.mutate(
      {
        templateId: template.id,
        changes: { name: name.trim(), description: trimmed, isDefault },
      },
      { onSuccess },
    );
  }

  return (
    <Sheet
      isVisible={isVisible}
      onDismiss={dismiss}
      isBusy={mutation.isPending}
      title={t(`templates.form.${isEditing ? "editTitle" : "createTitle"}`)}
      footer={
        <>
          {mutation.isError && (
            <FieldError visible>{t("templates.form.error")}</FieldError>
          )}

          <Button
            mode="contained"
            onPress={submit}
            disabled={!isSubmittable}
            loading={mutation.isPending}
          >
            {t(`templates.form.${isEditing ? "save" : "create"}`)}
          </Button>
          <Button mode="text" onPress={dismiss} disabled={mutation.isPending}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <TextInput
        mode="outlined"
        label={t("templates.form.name")}
        placeholder={t("templates.form.namePlaceholder")}
        value={name}
        onChangeText={setName}
        maxLength={NAME_MAX_LENGTH}
        autoFocus={!isEditing}
      />

      <TextInput
        mode="outlined"
        label={t("templates.form.description")}
        value={description}
        onChangeText={setDescription}
        maxLength={DESCRIPTION_MAX_LENGTH}
        multiline
      />

      <View style={styles.switchRow}>
        <View style={styles.switchLabels}>
          <Text variant="bodyLarge">{t("templates.form.default")}</Text>
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("templates.form.defaultHint")}
          </Text>
        </View>
        <Switch
          value={isDefault}
          onValueChange={setDefault}
          accessibilityLabel={t("templates.form.default")}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  switchLabels: { flex: 1, gap: SPACING.xxs },
});
