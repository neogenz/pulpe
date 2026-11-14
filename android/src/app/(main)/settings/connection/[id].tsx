import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Dialog,
  List,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "@/core/i18n/locale-store";
import { Card } from "@/core/ui/card";
import { formatInstantDay, formatRelativeDay } from "@/core/ui/date-format";
import { FieldError } from "@/core/ui/field-error";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import { SPACING } from "@/core/ui/theme";
import {
  useConnectionActivity,
  useConnections,
  useRevokeConnection,
} from "@/features/connections/connections-queries";
import { SettingsSectionTitle } from "@/features/account/components/settings-section";

/** Every write tool of the agent connector that has a plain-words label. */
const KNOWN_TOOLS = new Set([
  "add_movement",
  "update_movement",
  "delete_movement",
  "add_forecast",
  "update_forecast",
  "spread_expense",
  "create_month_from_template",
  "delete_month",
  "toggle_check",
  "create_tag",
  "rename_tag",
  "delete_tag",
  "tag_items",
  "create_template",
  "update_template",
  "delete_template",
  "duplicate_template",
  "edit_template_lines",
  "adjust_over_months",
]);

/**
 * One connection: what was granted, what the agent actually did, and the cut.
 * Mirrors `ConnectionDetailView` on iOS.
 */
export default function ConnectionDetailScreen() {
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const connection = useConnections().data?.find((item) => item.id === id);
  const canWrite = connection?.mode === "read_write";
  const activity = useConnectionActivity(id, canWrite);
  const revoke = useRevokeConnection();
  const [isConfirming, setConfirming] = useState(false);

  function confirmRevoke() {
    setConfirming(false);
    revoke.mutate(id, { onSuccess: () => router.back() });
  }

  // The tool in plain words; an unknown one falls back to its raw name rather
  // than a vague "Action": a wrong reassurance is worse than a slug.
  function toolLabel(tool: string): string {
    return KNOWN_TOOLS.has(tool)
      ? t(`settings.connections.tools.${tool}`)
      : tool;
  }

  function timestamp(instant: string): string {
    const date = new Date(instant);
    const time = date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${formatRelativeDay(date, new Date(), locale)} ${time}`;
  }

  const consequence = t("settings.connections.revokeConsequence", {
    name: connection?.clientName ?? "",
  });

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel={t("common.back")}
        />
        <Appbar.Content title={t("settings.connections.detailTitle")} />
      </ScreenAppBar>

      {connection === undefined ? (
        <ActivityIndicator
          style={styles.loading}
          accessibilityLabel={t("common.loading")}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text variant="headlineSmall">{connection.clientName}</Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("settings.connections.grantedOn", {
                mode: t(`settings.connections.modes.${connection.mode}`),
                date: formatInstantDay(connection.authorizedAt, locale),
              })}
            </Text>
          </View>

          {canWrite && (
            <View style={styles.section}>
              <SettingsSectionTitle>
                {t("settings.connections.activityTitle")}
              </SettingsSectionTitle>
              <Card mode="contained">
                {activity.isPending ? (
                  <ActivityIndicator
                    style={styles.loading}
                    accessibilityLabel={t("common.loading")}
                  />
                ) : activity.isError ? (
                  <List.Item title={t("settings.connections.activityError")} />
                ) : activity.data.length === 0 ? (
                  <List.Item title={t("settings.connections.activityEmpty")} />
                ) : (
                  activity.data.map((entry, index) => (
                    <List.Item
                      key={`${entry.tool}-${entry.createdAt}-${index}`}
                      title={toolLabel(entry.tool)}
                      description={
                        entry.outcome === "error"
                          ? `${t("settings.connections.failed")} · ${timestamp(entry.createdAt)}`
                          : timestamp(entry.createdAt)
                      }
                      descriptionStyle={
                        entry.outcome === "error"
                          ? { color: theme.colors.error }
                          : undefined
                      }
                    />
                  ))
                )}
              </Card>
            </View>
          )}

          <View style={styles.section}>
            {revoke.isError && (
              <FieldError visible>
                {t("settings.connections.revokeError")}
              </FieldError>
            )}
            <Button
              mode="outlined"
              textColor={theme.colors.error}
              loading={revoke.isPending}
              disabled={revoke.isPending}
              onPress={() => {
                revoke.reset();
                setConfirming(true);
              }}
            >
              {t("settings.connections.revoke")}
            </Button>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {consequence}
            </Text>
          </View>
        </ScrollView>
      )}

      <Portal>
        <Dialog visible={isConfirming} onDismiss={() => setConfirming(false)}>
          <Dialog.Title>{t("settings.connections.revokeTitle")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{consequence}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirming(false)}>
              {t("common.cancel")}
            </Button>
            <Button textColor={theme.colors.error} onPress={confirmRevoke}>
              {t("settings.connections.revoke")}
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
  header: { gap: SPACING.xs },
  section: { gap: SPACING.sm },
  loading: { marginTop: SPACING.xl },
});
