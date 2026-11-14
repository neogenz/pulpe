import { router } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  List,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatInstantDay } from "@/core/ui/date-format";
import { Card } from "@/core/ui/card";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import { SPACING } from "@/core/ui/theme";
import { useConnections } from "@/features/connections/connections-queries";

/**
 * The AI assistants branched on this account: the visible side of the promise
 * made on the web consent page. Mirrors `ConnectionsView` on iOS — connecting a
 * new one happens on the web, here one can only look and cut.
 */
export default function ConnectionsScreen() {
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const connections = useConnections();
  const pull = usePullToRefresh(() => connections.refetch());
  const list = connections.data ?? [];

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
        <Appbar.Content title={t("settings.connections.title")} />
      </ScreenAppBar>

      {connections.isPending ? (
        <ActivityIndicator
          style={styles.loading}
          accessibilityLabel={t("common.loading")}
        />
      ) : connections.isError ? (
        // An empty list means "no agent has access": a failure must never
        // borrow that face, or a network blip reads as a reassurance.
        <PlaceholderScreen
          icon="link-off"
          tone="neutral"
          title={t("system.queryError")}
          hint={t("common.loadErrorHint")}
          action={{
            label: t("common.retry"),
            onPress: () => void connections.refetch(),
          }}
        />
      ) : list.length === 0 ? (
        <PlaceholderScreen
          icon="link-variant"
          title={t("settings.connections.emptyTitle")}
          hint={t("settings.connections.emptyHint")}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl {...pull} />}
        >
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("settings.connections.subtitle")}
          </Text>
          <Card mode="contained">
            {list.map((connection) => (
              <List.Item
                key={connection.id}
                title={connection.clientName}
                description={t("settings.connections.since", {
                  mode: t(`settings.connections.modes.${connection.mode}`),
                  date: formatInstantDay(connection.authorizedAt, locale),
                })}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() =>
                  router.push({
                    pathname: "/settings/connection/[id]",
                    params: { id: connection.id },
                  })
                }
              />
            ))}
          </Card>
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("settings.connections.listFooter")}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("settings.connections.addHint")}
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xxl },
  loading: { marginTop: SPACING.xl },
});
