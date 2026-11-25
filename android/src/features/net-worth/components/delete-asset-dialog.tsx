import type { Asset } from "pulpe-shared";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";

/** Asks before an element and its whole history of values are deleted. */
export function DeleteAssetDialog({
  asset,
  onDismiss,
  onConfirm,
}: {
  asset: Asset | null;
  onDismiss: () => void;
  onConfirm: (asset: Asset) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Portal>
      <Dialog visible={asset !== null} onDismiss={onDismiss}>
        <Dialog.Title>
          {t("netWorth.deleteTitle", { name: asset?.name ?? "" })}
        </Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{t("netWorth.deleteMessage")}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t("common.cancel")}</Button>
          <Button
            textColor={theme.colors.error}
            onPress={() => {
              if (asset !== null) onConfirm(asset);
              onDismiss();
            }}
          >
            {t("common.delete")}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
