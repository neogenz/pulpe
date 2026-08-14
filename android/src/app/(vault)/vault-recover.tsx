import { router } from "expo-router";
import { useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";

import { hapticCommit, hapticSuccess } from "@/core/ui/haptics";
import { normalizeApiError } from "@/core/api/api-error";
import { useSessionStore } from "@/core/auth/session-store";
import { APP_URLS } from "@/core/ui/app-urls";
import { SPACING } from "@/core/ui/theme";
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
  const [hasInvalidCharacters, setHasInvalidCharacters] = useState(false);

  function update(input: string) {
    setHasInvalidCharacters(hasInvalidRecoveryKeyCharacters(input));
    onChange(formatRecoveryKey(input));
  }

  const message = hasInvalidCharacters
    ? "Ta clé contient des caractères invalides"
    : rejectionMessage;

  return (
    <PinScreen
      title="Clé de récupération"
      subtitle="Entre la clé que tu as notée en configurant ton code"
      footer={
        <>
          <Button onPress={() => router.back()}>Annuler</Button>
          <Text variant="bodySmall">Tu n&apos;as plus ta clé ?</Text>
          <Button onPress={() => void Linking.openURL(APP_URLS.support)}>
            Contacter le support
          </Button>
        </>
      }
    >
      <View style={styles.form}>
        <TextInput
          mode="outlined"
          label="Clé de récupération"
          placeholder="XXXX-XXXX-XXXX-…"
          value={value}
          onChangeText={update}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect={false}
          multiline
          style={styles.input}
        />
        <HelperText type="error" visible={message !== null}>
          {message}
        </HelperText>

        <Button
          mode="contained"
          disabled={!isCompleteRecoveryKey(value)}
          onPress={onSubmit}
        >
          Continuer
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
        return "Les codes ne correspondent pas";
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
        onKeyRejected(apiError.message);
        return null;
      }
    },
  );

  return (
    <PinScreen
      title={isConfirming ? "Confirme ton code" : "Nouveau code"}
      subtitle={
        isConfirming ? "Saisis-le une seconde fois" : `${PIN_LENGTH} chiffres`
      }
      footer={<Button onPress={onBack}>Revenir</Button>}
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
