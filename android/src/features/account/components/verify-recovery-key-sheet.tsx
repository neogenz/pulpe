import { useState } from "react";
import { Button, TextInput } from "react-native-paper";

import { hapticSuccess } from "@/core/ui/haptics";
import { normalizeApiError } from "@/core/api/api-error";
import { Sheet } from "@/core/ui/sheet";
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
      setErrorMessage(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      isVisible={isVisible}
      onDismiss={onDismiss}
      title="Vérifier ma clé de récupération"
      subtitle="Saisis la clé que tu as notée. Elle reste valable après la vérification."
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
            Vérifier
          </Button>
          <Button mode="text" onPress={onDismiss} disabled={isSubmitting}>
            Fermer
          </Button>
        </>
      }
    >
      <TextInput
        mode="outlined"
        label="Clé de récupération"
        value={value}
        onChangeText={update}
        autoCapitalize="characters"
        autoCorrect={false}
        multiline
        autoFocus
      />
      {hasInvalidCharacters && (
        <FieldError visible>
          Une clé ne contient que des lettres et les chiffres 2 à 7.
        </FieldError>
      )}
    </Sheet>
  );
}
