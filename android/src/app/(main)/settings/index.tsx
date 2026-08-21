import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import {
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
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

import { ScreenAppBar } from "@/core/ui/screen-app-bar";

import { useSessionStore } from "@/core/auth/session-store";
import { useTranslation } from "@/core/i18n/locale-store";
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
  const { t } = useTranslation();
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
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={t("settings.account.title")} />
      </ScreenAppBar>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={profile.isRefetching}
            onRefresh={() => void profile.refetch()}
          />
        }
      >
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
              {t("settings.account.editProfile")}
            </Button>
          )}
        </View>

        <SettingsSection title={t("settings.account.sections.application")}>
          <SettingsRow
            icon="shield-lock-outline"
            title={t("settings.account.rows.security.title")}
            description={t("settings.account.rows.security.description")}
            onPress={() => router.push("/settings/security")}
          />
          <SettingsRow
            testID="settings-preferences"
            icon="cog-outline"
            title={t("settings.account.rows.preferences.title")}
            description={t("settings.account.rows.preferences.description")}
            onPress={() => router.push("/settings/preferences")}
          />
          <SettingsRow
            icon="tag-outline"
            title={t("settings.account.rows.tags.title")}
            description={t("settings.account.rows.tags.description")}
            onPress={() => router.push("/settings/tags")}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.account.sections.support")}>
          <SettingsRow
            icon="help-circle-outline"
            title={t("settings.account.rows.faq.title")}
            description={t("settings.account.rows.faq.description")}
            isExternal
            onPress={() => void Linking.openURL(APP_URLS.support)}
          />
          <SettingsRow
            icon="star-four-points-outline"
            title={t("settings.account.rows.whatsNew.title")}
            description={t("settings.account.rows.whatsNew.description")}
            isExternal
            onPress={() => void Linking.openURL(APP_URLS.changelog)}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.account.sections.legal")}>
          <SettingsRow
            icon="file-document-outline"
            title={t("settings.account.rows.terms.title")}
            description={t("settings.account.rows.terms.description")}
            isExternal
            onPress={() => void Linking.openURL(APP_URLS.terms)}
          />
          <SettingsRow
            icon="hand-back-right-outline"
            title={t("settings.account.rows.privacy.title")}
            description={t("settings.account.rows.privacy.description")}
            isExternal
            onPress={() => void Linking.openURL(APP_URLS.privacy)}
          />
        </SettingsSection>

        <Button
          mode="text"
          textColor={theme.colors.error}
          onPress={() => setSigningOut(true)}
        >
          {t("common.signOut")}
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
          <Dialog.Title>{t("settings.account.signOut.title")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t("settings.account.signOut.description")}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSigningOut(false)}>
              {t("common.cancel")}
            </Button>
            {/* No navigation here: the root layout sends an unauthenticated
                session back to the login screen on its own. */}
            <Button
              textColor={theme.colors.error}
              onPress={() => void signOut()}
            >
              {t("common.signOut")}
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
