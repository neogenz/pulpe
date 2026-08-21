import { useState } from "react";
import { Button, TextInput } from "react-native-paper";

import { isInvalidCredentials } from "@/core/auth/auth-error";
import { verifyPassword } from "@/core/auth/supabase";
import { useTranslation } from "@/core/i18n/locale-store";
import { Sheet } from "@/core/ui/sheet";
import { FieldError } from "@/core/ui/field-error";

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
  const { t } = useTranslation();
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
      setErrorMessage(
        t(
          isInvalidCredentials(error)
            ? "settings.security.confirmPasswordIncorrect"
            : "settings.security.recoveryError",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      isVisible={isVisible}
      onDismiss={onDismiss}
      isBusy={isSubmitting}
      title={title}
      subtitle={message}
      footer={
        <>
          {errorMessage !== null && (
            <FieldError visible>{errorMessage}</FieldError>
          )}

          <Button
            mode="contained"
            onPress={() => void submit()}
            disabled={password.length === 0 || isSubmitting}
            loading={isSubmitting}
          >
            {t("settings.security.confirmPasswordAction")}
          </Button>
          <Button mode="text" onPress={onDismiss} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <TextInput
        mode="outlined"
        label={t("common.password")}
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
