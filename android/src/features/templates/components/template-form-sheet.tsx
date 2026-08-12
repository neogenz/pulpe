import * as Haptics from "expo-haptics";
import type { BudgetTemplate } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  HelperText,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { Sheet } from "@/core/ui/sheet";
import { SPACING } from "@/core/ui/theme";

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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      title={isEditing ? "Modifier le modèle" : "Nouveau modèle"}
      footer={
        <>
          {mutation.isError && (
            <HelperText type="error" visible>
              Le modèle n&apos;a pas pu être enregistré. Réessaie.
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={submit}
            disabled={!isSubmittable}
            loading={mutation.isPending}
          >
            {isEditing ? "Enregistrer" : "Créer le modèle"}
          </Button>
          <Button mode="text" onPress={dismiss} disabled={mutation.isPending}>
            Annuler
          </Button>
        </>
      }
    >
      <TextInput
        mode="outlined"
        label="Nom"
        placeholder="Mois standard, mois d'été…"
        value={name}
        onChangeText={setName}
        maxLength={NAME_MAX_LENGTH}
        autoFocus={!isEditing}
      />

      <TextInput
        mode="outlined"
        label="Description (facultatif)"
        value={description}
        onChangeText={setDescription}
        maxLength={DESCRIPTION_MAX_LENGTH}
        multiline
      />

      <View style={styles.switchRow}>
        <View style={styles.switchLabels}>
          <Text variant="bodyLarge">Modèle par défaut</Text>
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Tes prochains mois seront créés à partir de celui-ci.
          </Text>
        </View>
        <Switch
          value={isDefault}
          onValueChange={setDefault}
          accessibilityLabel="Modèle par défaut"
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
