import { router } from "expo-router";
import { useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";

import { hapticCommit, hapticSuccess } from "@/core/ui/haptics";
import { normalizeApiError } from "@/core/api/api-error";
import { useSessionStore } from "@/core/auth/session-store";
import { useTranslation } from "@/core/i18n/locale-store";
import { APP_URLS } from "@/core/ui/app-urls";
import { SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";
import {
  formatRecoveryKey,
  hasInvalidRecoveryKeyCharacters,
  isCompleteRecoveryKey,
  stripRecoveryKey,
} from "@/core/vault/recovery-key";
import { recoverVaultWithKey } from "@/core/vault/vault-store";
import { PIN_LENGTH, PinPad } from "@/ui/pin-pad";
import { PinScreen } from "@/ui/pin-screen";
import { usePinEntry } from "@/ui/use-pin-entry";

const HTTP_UNAUTHORIZED = 401;

/**
 * The way back in when the PIN is gone. The recovery key unwraps the vault so
 * it can be rewrapped under a new PIN — the amounts themselves are never
 * re-encrypted client-side, the server does that under the new key.
 */
export default function VaultRecoverScreen() {
  const [recoveryKey, setRecoveryKey] = useState("");
  const [isEnteringPin, setIsEnteringPin] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

  function backToKeyStep(message: string | null) {
    setRecoveryKey("");
    setIsEnteringPin(false);
    setRejectionMessage(message);
  }

  return isEnteringPin ? (
    <NewPinStep
      recoveryKey={recoveryKey}
      onBack={() => backToKeyStep(null)}
      // The PIN step unmounts with this call, so its own error slot cannot
      // carry the reason — the step the user lands on has to.
      onKeyRejected={backToKeyStep}
    />
  ) : (
    <RecoveryKeyStep
      value={recoveryKey}
      rejectionMessage={rejectionMessage}
      onChange={(next) => {
        setRecoveryKey(next);
        setRejectionMessage(null);
      }}
      onSubmit={() => setIsEnteringPin(true)}
    />
  );
}

interface RecoveryKeyStepProps {
  value: string;
  rejectionMessage: string | null;
  onChange: (next: string) => void;
  onSubmit: () => void;
}

function RecoveryKeyStep({
  value,
  rejectionMessage,
  onChange,
  onSubmit,
}: RecoveryKeyStepProps) {
  const { t } = useTranslation();
  const [hasInvalidCharacters, setHasInvalidCharacters] = useState(false);

  function update(input: string) {
    setHasInvalidCharacters(hasInvalidRecoveryKeyCharacters(input));
    onChange(formatRecoveryKey(input));
  }

  const message = hasInvalidCharacters
    ? t("vault.recovery.invalidCharacters")
    : rejectionMessage;

  return (
    <PinScreen
      title={t("vault.recovery.title")}
      subtitle={t("vault.recovery.subtitle")}
      footer={
        <>
          <Button onPress={() => router.back()}>{t("common.cancel")}</Button>
          <Text variant="bodySmall">{t("vault.recovery.lostKey")}</Text>
          <Button onPress={() => void Linking.openURL(APP_URLS.support)}>
            {t("common.contactSupport")}
          </Button>
        </>
      }
    >
      <View style={styles.form}>
        <TextInput
          mode="outlined"
          label={t("vault.recovery.title")}
          placeholder={t("vault.recovery.placeholder")}
          value={value}
          onChangeText={update}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect={false}
          multiline
          style={styles.input}
        />
        <FieldError visible={message !== null}>{message}</FieldError>

        <Button
          mode="contained"
          disabled={!isCompleteRecoveryKey(value)}
          onPress={onSubmit}
        >
          {t("common.continue")}
        </Button>
      </View>
    </PinScreen>
  );
}

interface NewPinStepProps {
  recoveryKey: string;
  onBack: () => void;
  onKeyRejected: (message: string) => void;
}

function NewPinStep({ recoveryKey, onBack, onKeyRejected }: NewPinStepProps) {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const firstPin = useRef<string | null>(null);
  const signOut = useSessionStore((state) => state.signOut);

  const { pin, setPin, errorMessage, isBusy } = usePinEntry(
    async (candidate) => {
      if (firstPin.current === null) {
        firstPin.current = candidate;
        setIsConfirming(true);
        hapticCommit();
        return null;
      }

      if (candidate !== firstPin.current) {
        firstPin.current = null;
        setIsConfirming(false);
        return t("vault.pinMismatch");
      }

      try {
        await recoverVaultWithKey(stripRecoveryKey(recoveryKey), candidate);
        hapticSuccess();
        return null;
      } catch (error) {
        const apiError = normalizeApiError(error);
        if (apiError.status === HTTP_UNAUTHORIZED) {
          // Rewrapping needs an authenticated call, and this session no longer
          // is one. Signing in again is the only way through.
          void signOut();
          return null;
        }

        // The key is what the server rejected, so sending the same one again
        // under a different PIN would only repeat the failure.
        onKeyRejected(t("vault.recovery.rejected"));
        return null;
      }
    },
  );

  return (
    <PinScreen
      title={t(isConfirming ? "vault.confirmPin" : "vault.recovery.newPin")}
      subtitle={
        isConfirming
          ? t("vault.repeatPin")
          : t("vault.pinLength", { count: PIN_LENGTH })
      }
      footer={<Button onPress={onBack}>{t("common.back")}</Button>}
    >
      <PinPad
        value={pin}
        onChange={setPin}
        errorMessage={errorMessage}
        isDisabled={isBusy}
      />
    </PinScreen>
  );
}

const styles = StyleSheet.create({
  form: { alignSelf: "stretch", gap: SPACING.sm },
  input: { textAlign: "center" },
});
