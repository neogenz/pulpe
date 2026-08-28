import { useState } from "react";
import { Button, TextInput } from "react-native-paper";
import { API_ERROR_CODES } from "pulpe-shared";

import { isApiError } from "@/core/api/api-error";
import { useTranslation } from "@/core/i18n/locale-store";
import { hapticSuccess } from "@/core/ui/haptics";
import { FormModal } from "@/core/ui/sheet";
import { FieldError } from "@/core/ui/field-error";
import {
  formatRecoveryKey,
  hasInvalidRecoveryKeyCharacters,
  isCompleteRecoveryKey,
  stripRecoveryKey,
} from "@/core/vault/recovery-key";
import { checkRecoveryKey } from "@/core/vault/vault-store";

/**
 * Answers the one question a written-down key raises: is this still the right
 * one? It is checked, never spent — the key keeps working afterwards, which is
 * what makes this safe to run any time.
 */
export function VerifyRecoveryKeySheet({
  isVisible,
  onDismiss,
  onVerified,
}: {
  isVisible: boolean;
  onDismiss: () => void;
  onVerified: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [hasInvalidCharacters, setHasInvalidCharacters] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  function update(input: string) {
    setHasInvalidCharacters(hasInvalidRecoveryKeyCharacters(input));
    setErrorMessage(null);
    setValue(formatRecoveryKey(input));
  }

  async function submit() {
    if (!isCompleteRecoveryKey(value) || isSubmitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await checkRecoveryKey(stripRecoveryKey(value));
      hapticSuccess();
      onVerified();
    } catch (error) {
      const code = isApiError(error) ? error.code : undefined;
      setErrorMessage(
        t(
          code === API_ERROR_CODES.RECOVERY_KEY_INVALID
            ? "vault.recovery.rejected"
            : code === API_ERROR_CODES.RECOVERY_KEY_NOT_CONFIGURED
              ? "vault.recovery.notConfigured"
              : "settings.security.recoveryError",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      isVisible={isVisible}
      onDismiss={onDismiss}
      isBusy={isSubmitting}
      title={t("settings.security.verifyRecoveryTitle")}
      subtitle={t("settings.security.verifyRecoverySubtitle")}
      footer={
        <>
          {errorMessage !== null && (
            <FieldError visible>{errorMessage}</FieldError>
          )}

          <Button
            mode="contained"
            onPress={() => void submit()}
            disabled={!isCompleteRecoveryKey(value) || isSubmitting}
            loading={isSubmitting}
          >
            {t("settings.security.verifyRecoveryAction")}
          </Button>
          <Button mode="text" onPress={onDismiss} disabled={isSubmitting}>
            {t("common.close")}
          </Button>
        </>
      }
    >
      <TextInput
        mode="outlined"
        label={t("vault.recovery.title")}
        value={value}
        onChangeText={update}
        autoCapitalize="characters"
        autoCorrect={false}
        multiline
        autoFocus
      />
      {hasInvalidCharacters && (
        <FieldError visible>
          {t("settings.security.recoveryInvalidCharacters")}
        </FieldError>
      )}
    </FormModal>
  );
}
