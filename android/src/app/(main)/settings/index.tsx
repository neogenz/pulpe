import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Avatar,
  Button,
  Dialog,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSessionStore } from "@/core/auth/session-store";
import { APP_URLS } from "@/core/ui/app-urls";
import { SPACING } from "@/core/ui/theme";
import { useUserProfile } from "@/features/account/account-queries";
import { ProfileSheet } from "@/features/account/components/profile-sheet";
import {
  SettingsRow,
  SettingsSection,
} from "@/features/account/components/settings-section";

const AVATAR_SIZE = 72;

/**
 * Everything about the account rather than about a month: who you are, how the
 * app is locked, what it assumes about your money, and the way out. Mirrors
 * `AccountView` on iOS, section for section.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const profile = useUserProfile();
  const sessionEmail = useSessionStore((state) => state.user?.email);
  const signOut = useSessionStore((state) => state.signOut);
  const [isEditingProfile, setEditingProfile] = useState(false);
  const [isSigningOut, setSigningOut] = useState(false);

  // The session knows the email before the profile request lands, so the
  // header is never blank on the way in.
  const email = profile.data?.email ?? sessionEmail ?? "";
  const fullName = [profile.data?.firstName, profile.data?.lastName]
    .filter((part) => part !== undefined && part.length > 0)
    .join(" ");
  const initial = (fullName || email || "?").slice(0, 1).toLocaleUpperCase();
  const version = Constants.expoConfig?.version ?? "";

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header mode="small" elevated={false}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Compte" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          {/* Decorative: the name and email right below carry the identity. */}
          <Avatar.Text
            size={AVATAR_SIZE}
            label={initial}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          {fullName.length > 0 && <Text variant="titleMedium">{fullName}</Text>}
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {email}
          </Text>
          {profile.data !== undefined && (
            <Button
              mode="text"
              icon="pencil-outline"
              onPress={() => setEditingProfile(true)}
            >
              Modifier mon profil
            </Button>
          )}
        </View>

        <SettingsSection title="PARAMÈTRES DE L'APPLICATION">
          <SettingsRow
            icon="shield-lock-outline"
            title="Sécurité"
            description="Code PIN, mot de passe, biométrie"
            onPress={() => router.push("/settings/security")}
          />
          <SettingsRow
            icon="cog-outline"
            title="Préférences"
            description="Jour de paie et devise"
            onPress={() => router.push("/settings/preferences")}
          />
          <SettingsRow
            icon="tag-outline"
            title="Mes tags"
            description="Tes tags personnels"
            onPress={() => router.push("/settings/tags")}
          />
        </SettingsSection>

        <SettingsSection title="SUPPORT">
          <SettingsRow
            icon="help-circle-outline"
            title="FAQ et support"
            description="Aide et questions fréquentes"
            isExternal
            onPress={() => void Linking.openURL(APP_URLS.support)}
          />
          <SettingsRow
            icon="star-four-points-outline"
            title="Nouveautés"
            description="Dernières mises à jour"
            isExternal
            onPress={() => void Linking.openURL(APP_URLS.changelog)}
          />
        </SettingsSection>

        <SettingsSection title="LÉGAL">
          <SettingsRow
            icon="file-document-outline"
            title="Conditions générales"
            description="Conditions d'utilisation de Pulpe"
            isExternal
            onPress={() => void Linking.openURL(APP_URLS.terms)}
          />
          <SettingsRow
            icon="hand-back-right-outline"
            title="Avis de confidentialité"
            description="Protection de tes données"
            isExternal
            onPress={() => void Linking.openURL(APP_URLS.privacy)}
          />
        </SettingsSection>

        <Button
          mode="text"
          textColor={theme.colors.error}
          onPress={() => setSigningOut(true)}
        >
          Déconnexion
        </Button>

        <Text
          variant="labelSmall"
          style={[styles.version, { color: theme.colors.onSurfaceVariant }]}
        >
          Pulpe {version}
        </Text>
      </ScrollView>

      {/* Mounted only while open: it seeds its fields from the profile once. */}
      {isEditingProfile && profile.data !== undefined && (
        <ProfileSheet
          isVisible
          onDismiss={() => setEditingProfile(false)}
          profile={profile.data}
        />
      )}

      <Portal>
        <Dialog visible={isSigningOut} onDismiss={() => setSigningOut(false)}>
          <Dialog.Title>Déconnexion</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Tu devras te reconnecter avec ton email et ton mot de passe, puis
              ressaisir ton code PIN.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSigningOut(false)}>Annuler</Button>
            {/* No navigation here: the root layout sends an unauthenticated
                session back to the login screen on its own. */}
            <Button
              textColor={theme.colors.error}
              onPress={() => void signOut()}
            >
              Déconnecter
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xxl },
  profile: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  version: { textAlign: "center" },
});
