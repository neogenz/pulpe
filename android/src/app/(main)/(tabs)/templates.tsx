import { router } from "expo-router";
import * as Linking from "expo-linking";
import type { BudgetTemplate } from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Chip,
  FAB,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Tooltip } from "@/core/tips/tooltip";
import { useTranslation } from "@/core/i18n/locale-store";
import { Card } from "@/core/ui/card";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { APP_URLS } from "@/core/ui/app-urls";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { FAB_CLEARANCE, SPACING } from "@/core/ui/theme";
import { TemplateFormSheet } from "@/features/templates/components/template-form-sheet";
import { useTemplates } from "@/features/templates/template-queries";
import {
  canCreateTemplate,
  MAX_TEMPLATES,
} from "@/features/templates/template-vm";

/**
 * The models new months are created from. Capped at five, same as iOS — the
 * count is shown rather than the cap being discovered at the moment of adding
 * a sixth.
 */
export default function TemplatesScreen() {
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const theme = useTheme();
  const { t } = useTranslation();
  const templates = useTemplates();
  const [isCreating, setCreating] = useState(false);

  if (templates.isPending) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </SafeAreaView>
    );
  }

  if (templates.isError) {
    return (
      <PlaceholderScreen
        icon="cloud-off-outline"
        title={t("templates.list.loadErrorTitle")}
        hint={t("common.loadErrorHint")}
        action={{
          label: t("common.retry"),
          onPress: () => void templates.refetch(),
        }}
      />
    );
  }

  const list = templates.data ?? [];
  const canAdd = canCreateTemplate(list.length);

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      {list.length === 0 ? (
        <PlaceholderScreen
          icon="file-document-outline"
          title={t("templates.list.emptyTitle")}
          hint={t("templates.list.emptyHint")}
          action={{
            label: t("templates.list.create"),
            onPress: () => setCreating(true),
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={templates.isRefetching}
              onRefresh={() => void templates.refetch()}
            />
          }
        >
          <View style={styles.header}>
            <Text variant="headlineSmall">{t("templates.list.title")}</Text>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("templates.list.count", {
                count: list.length,
                max: MAX_TEMPLATES,
              })}
            </Text>
          </View>

          <Tooltip
            id="templates-web-parity"
            icon="laptop"
            title={t("templates.list.webTitle")}
            message={t("templates.list.webBody")}
            action={{
              label: t("templates.list.openWeb"),
              onPress: () =>
                void Linking.openURL(APP_URLS.webappBudgetTemplates),
            }}
          />

          {list.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}

          {!canAdd && (
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("templates.list.limit", { count: MAX_TEMPLATES })}
            </Text>
          )}
        </ScrollView>
      )}

      {/* Hidden while the sheet is up: the FAB floats above the Portal's scrim
          and would otherwise sit on top of the form it just opened. */}
      {list.length > 0 && canAdd && !isCreating && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => setCreating(true)}
          accessibilityLabel={t("templates.list.addAccessibility")}
        />
      )}

      {/* Mounted only while open: the form seeds its fields once, so a sheet
          kept alive would reopen on the last thing that was typed into it. */}
      {isCreating && (
        <TemplateFormSheet
          isVisible
          onDismiss={() => setCreating(false)}
          onSaved={(template) => {
            setCreating(false);
            router.push(`/template/${template.id}`);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function TemplateCard({ template }: { template: BudgetTemplate }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Card
      mode="contained"
      onPress={() => router.push(`/template/${template.id}`)}
    >
      <Card.Content style={styles.card}>
        <View style={styles.cardHeader}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            {template.name}
          </Text>
          {template.isDefault === true && (
            <Chip compact>{t("templates.form.default")}</Chip>
          )}
        </View>
        {template.description !== undefined &&
          template.description.length > 0 && (
            <Text
              variant="bodyMedium"
              numberOfLines={2}
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {template.description}
            </Text>
          )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
    paddingBottom: FAB_CLEARANCE,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  card: { gap: SPACING.xs },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  cardTitle: { flex: 1 },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
