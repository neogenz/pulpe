import { router } from "expo-router";
import * as Linking from "expo-linking";
import type { BudgetTemplate } from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, FAB, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePushOnce } from "@/core/navigation/push-once";
import { Tooltip } from "@/core/tips/tooltip";
import { useTranslation } from "@/core/i18n/locale-store";
import { IconDisc } from "@/core/ui/icon-disc";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { SectionHeader } from "@/core/ui/section-header";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { APP_URLS } from "@/core/ui/app-urls";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { TabHeader } from "@/core/ui/tab-header";
import { FAB_CLEARANCE, SPACING } from "@/core/ui/theme";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
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
  const pull = usePullToRefresh(() => templates.refetch());
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

  const list = templates.data ?? [];
  const canAdd = canCreateTemplate(list.length);
  const header = <TabHeader title={t("templates.list.title")} />;

  if (templates.isError) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {header}
        <PlaceholderScreen
          icon="cloud-off-outline"
          title={t("templates.list.loadErrorTitle")}
          hint={t("common.loadErrorHint")}
          action={{
            label: t("common.retry"),
            onPress: () => void templates.refetch(),
          }}
        />
      </View>
    );
  }

  return (
    // The app bar carries the status bar inset; asking the safe area for the
    // top edge too would double it.
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {header}
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
          refreshControl={<RefreshControl {...pull} />}
        >
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

          <View style={styles.section}>
            <SectionHeader
              title={t("templates.list.section")}
              count={list.length}
            />
            <LedgerCard>
              {list.map((template) => (
                <TemplateRow key={template.id} template={template} />
              ))}
            </LedgerCard>
            {/* The count is shown rather than the cap being discovered at the
                moment of adding a sixth. */}
            <Text
              variant="bodySmall"
              style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}
            >
              {canAdd
                ? t("templates.list.count", {
                    count: list.length,
                    max: MAX_TEMPLATES,
                  })
                : t("templates.list.limit", { count: MAX_TEMPLATES })}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Gone at the limit, where the footer says why; the empty state names
          the action itself, so the plus sign only carries it over a list. */}
      {canAdd && list.length > 0 && (
        <FAB
          testID="templates-create"
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
    </View>
  );
}

function TemplateRow({ template }: { template: BudgetTemplate }) {
  const theme = useTheme();
  const push = usePushOnce();
  const { t } = useTranslation();
  const description =
    template.isDefault === true
      ? t("templates.form.default")
      : template.description !== undefined && template.description.length > 0
        ? template.description
        : undefined;

  return (
    <LedgerRow
      testID={`template-row-${template.id}`}
      leading={
        <IconDisc name="file-document-outline" tint={theme.colors.primary} />
      }
      title={template.name}
      subtitle={description}
      onPress={() => push(`/template/${template.id}`)}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    padding: SPACING.md,
    gap: SPACING.lg,
    paddingBottom: FAB_CLEARANCE,
  },
  section: { gap: SPACING.sm },
  footer: { paddingHorizontal: SPACING.md },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
