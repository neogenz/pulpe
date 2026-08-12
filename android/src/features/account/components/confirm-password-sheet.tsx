import { useState } from "react";
import { Button, HelperText, TextInput } from "react-native-paper";

import { verifyPassword } from "@/core/auth/supabase";
import { Sheet } from "@/core/ui/sheet";

/**
 * Stands between an unlocked session and an act only the account holder should
 * be able to perform. Minting a new recovery key invalidates the written-down
 * one, so an unattended phone must not be enough to do it.
 */
export function ConfirmPasswordSheet({
  isVisible,
  onDismiss,
  email,
  title,
  message,
  onConfirmed,
}: {
  isVisible: boolean;
  onDismiss: () => void;
  email: string;
  title: string;
  message: string;
  /** Runs once the password checks out; its failure is shown here. */
  onConfirmed: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function submit() {
    if (password.length === 0 || isSubmitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await verifyPassword(email, password);
      await onConfirmed();
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      setErrorMessage(
        raw.toLowerCase().includes("invalid login credentials")
          ? "Mot de passe incorrect."
          : raw || "L'opération a échoué. Réessaie.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      isVisible={isVisible}
      onDismiss={onDismiss}
      title={title}
      subtitle={message}
      footer={
        <>
          {errorMessage !== null && (
            <HelperText type="error" visible>
              {errorMessage}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={() => void submit()}
            disabled={password.length === 0 || isSubmitting}
            loading={isSubmitting}
          >
            Confirmer
          </Button>
          <Button mode="text" onPress={onDismiss} disabled={isSubmitting}>
            Annuler
          </Button>
        </>
      }
    >
      <TextInput
        mode="outlined"
        label="Ton mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        autoFocus
      />
    </Sheet>
  );
}
