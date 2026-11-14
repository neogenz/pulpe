import { useState } from "react";
import { Button, TextInput } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { FieldError } from "@/core/ui/field-error";
import { hapticSuccess } from "@/core/ui/haptics";
import { FormModal } from "@/core/ui/sheet";

import type { NetWorthGroup } from "../net-worth-sections";
import { useRenameAssetCategory } from "../net-worth-queries";

const TYPE_MAX_LENGTH = 30;

/** Renames one Type, opened from the menu of its card. Mounted only while open. */
export function RenameTypeSheet({
  type,
  onDismiss,
}: {
  type: NetWorthGroup;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const rename = useRenameAssetCategory();
  const [name, setName] = useState(type.name);
  const trimmed = name.trim();
  const canSave = trimmed !== "" && !rename.isPending;

  function save() {
    if (!canSave) return;
    if (trimmed === type.name) {
      onDismiss();
      return;
    }
    rename.mutate(
      { categoryId: type.id, changes: { name: trimmed } },
      {
        onSuccess: () => {
          hapticSuccess();
          onDismiss();
        },
      },
    );
  }

  return (
    <FormModal
      isVisible
      onDismiss={onDismiss}
      isBusy={rename.isPending}
      title={t("netWorth.renameType")}
      footer={
        <>
          {rename.isError && (
            <FieldError visible>{t("netWorth.saveError")}</FieldError>
          )}
          <Button
            mode="contained"
            onPress={save}
            disabled={!canSave}
            loading={rename.isPending}
          >
            {t("netWorth.form.save")}
          </Button>
        </>
      }
    >
      <TextInput
        mode="outlined"
        autoFocus
        label={t("netWorth.typeName")}
        value={name}
        onChangeText={setName}
        maxLength={TYPE_MAX_LENGTH}
        onSubmitEditing={save}
      />
    </FormModal>
  );
}
