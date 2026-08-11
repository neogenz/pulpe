import * as Haptics from "expo-haptics";
import type { UserProfile } from "pulpe-shared";
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

import { RADIUS, SPACING } from "@/core/ui/theme";

import { useUpdateUserProfile } from "../account-queries";

/** `updateProfileSchema` accepts 1 to 50 characters on both names. */
const NAME_MAX_LENGTH = 50;

/**
 * The identity Pulpe greets you by. The email is shown but not editable: it is
 * the login itself, and changing it is a Supabase flow with its own
 * confirmation round-trip.
 */
export function ProfileSheet({
  isVisible,
  onDismiss,
  profile,
}: {
  isVisible: boolean;
  onDismiss: () => void;
  profile: UserProfile;
}) {
  const theme = useTheme();
  const update = useUpdateUserProfile();
  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [lastName, setLastName] = useState(profile.lastName ?? "");

  // The server requires both, so a half-filled form has nothing to send.
  const isSubmittable =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    !update.isPending;

  function submit() {
    if (!isSubmittable) return;

    update.mutate(
      { firstName: firstName.trim(), lastName: lastName.trim() },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          onDismiss();
        },
      },
    );
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
          <Text variant="titleMedium">Ton profil</Text>

          <TextInput
            mode="outlined"
            label="Prénom"
            value={firstName}
            onChangeText={setFirstName}
            maxLength={NAME_MAX_LENGTH}
            autoCapitalize="words"
            autoFocus
          />
          <TextInput
            mode="outlined"
            label="Nom"
            value={lastName}
            onChangeText={setLastName}
            maxLength={NAME_MAX_LENGTH}
            autoCapitalize="words"
          />

          <TextInput
            mode="outlined"
            label="Email"
            value={profile.email}
            editable={false}
          />
          <HelperText type="info" visible>
            Ton email est ton identifiant de connexion.
          </HelperText>

          {update.isError && (
            <HelperText type="error" visible>
              Ton profil n&apos;a pas pu être enregistré. Réessaie.
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={submit}
            disabled={!isSubmittable}
            loading={update.isPending}
          >
            Enregistrer
          </Button>
          <Button mode="text" onPress={onDismiss} disabled={update.isPending}>
            Annuler
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
