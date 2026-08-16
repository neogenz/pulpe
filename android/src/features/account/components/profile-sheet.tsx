import type { UserProfile } from "pulpe-shared";
import { useState } from "react";
import { Button, HelperText, TextInput } from "react-native-paper";

import { hapticSuccess } from "@/core/ui/haptics";
import { Sheet } from "@/core/ui/sheet";
import { FieldError } from "@/core/ui/field-error";

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
          hapticSuccess();
          onDismiss();
        },
      },
    );
  }

  return (
    <Sheet
      isVisible={isVisible}
      onDismiss={onDismiss}
      title="Ton profil"
      footer={
        <>
          {update.isError && (
            <FieldError visible>
              Ton profil n&apos;a pas pu être enregistré. Réessaie.
            </FieldError>
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
        </>
      }
    >
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
    </Sheet>
  );
}
