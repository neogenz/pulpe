import * as Haptics from "expo-haptics";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import {
  Button,
  HelperText,
  Modal,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { normalizeApiError } from "@/core/api/api-error";
import { RADIUS, SPACING } from "@/core/ui/theme";
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
  const theme = useTheme();
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onVerified();
    } catch (error) {
      setErrorMessage(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Portal>
      <Modal
        visible={isVisible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.sheet,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="titleMedium">Vérifier ma clé de récupération</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Saisis la clé que tu as notée. Elle reste valable après la
            vérification.
          </Text>

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
            <HelperText type="error" visible>
              Une clé ne contient que des lettres et les chiffres 2 à 7.
            </HelperText>
          )}

          {errorMessage !== null && (
            <HelperText type="error" visible>
              {errorMessage}
            </HelperText>
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
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    maxHeight: "88%",
  },
  content: { padding: SPACING.lg, gap: SPACING.md },
});
