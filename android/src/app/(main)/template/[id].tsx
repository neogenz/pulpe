import { router, useLocalSearchParams } from "expo-router";
import {
  BudgetFormulas,
  type SupportedCurrency,
  type TemplateLine,
} from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Chip,
  Dialog,
  Menu,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "@/core/i18n/locale-store";
import { ActionButton } from "@/core/ui/action-button";
import { IconDisc } from "@/core/ui/icon-disc";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { SectionHeader } from "@/core/ui/section-header";
import { StateChip } from "@/core/ui/state-chip";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";

import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { formatMonthLabel } from "@/core/ui/date-format";
import { FadingRail } from "@/core/ui/fading-rail";
import { InlineQueryError } from "@/core/ui/inline-query-error";
import { FieldError } from "@/core/ui/field-error";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { Amount } from "@/core/ui/amount";
import { SPACING } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { TemplateFormSheet } from "@/features/templates/components/template-form-sheet";
import { TemplateLines } from "@/features/templates/components/template-lines";
import { TemplateLineSheet } from "@/features/templates/components/template-line-sheet";
import {
  useDeleteTemplate,
  useDeleteTemplateLine,
  useTemplate,
  useTemplateLines,
  useTemplateUsage,
} from "@/features/templates/template-queries";
import { propagationBudgetCount } from "@/features/templates/template-vm";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

/**
 * One model: what it plans for a month, and which budgets already came out of
 * it. Editing a forecast can reach those budgets, so the count is loaded here
 * and handed to the editor rather than fetched again per edit.
 */
export default function TemplateDetailScreen() {
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const financial = useFinancialColors();
  const { locale, t } = useTranslation();
  const settings = useUserSettings();
  const template = useTemplate(id);
  const lines = useTemplateLines(id);
  const usage = useTemplateUsage(id);
  const removeLine = useDeleteTemplateLine();
  const removeTemplate = useDeleteTemplate();
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isRenaming, setRenaming] = useState(false);
  const [isAdding, setAdding] = useState(false);
  const [editedLine, setEditedLine] = useState<TemplateLine | null>(null);
  const [deletedLine, setDeletedLine] = useState<TemplateLine | null>(null);
  const [isDeletingTemplate, setDeletingTemplate] = useState(false);

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;

  if (template.isPending || lines.isPending || settings.isPending) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </SafeAreaView>
    );
  }

  if (template.isError || lines.isError || settings.isError) {
    return (
      <PlaceholderScreen
        icon="cloud-off-outline"
        title={t("templates.detail.loadErrorTitle")}
        hint={t("common.loadErrorHint")}
        action={{
          label: t("common.retry"),
          onPress: () =>
            void Promise.all([
              template.refetch(),
              lines.refetch(),
              settings.refetch(),
            ]),
        }}
      />
    );
  }

  if (template.data === undefined) {
    return (
      <PlaceholderScreen
        icon="file-remove-outline"
        title={t("templates.detail.missingTitle")}
        hint={t("templates.detail.missingHint")}
        action={{ label: t("common.back"), onPress: () => router.back() }}
      />
    );
  }

  const list = lines.data ?? [];
  const totals = BudgetFormulas.calculateTemplateTotals(list);
  const isUsageReady = usage.data !== undefined && !usage.isError;
  const propagationCount = isUsageReady
    ? propagationBudgetCount(usage.data)
    : 0;

  function dismissLineDeletion() {
    if (removeLine.isPending) return;
    removeLine.reset();
    setDeletedLine(null);
  }

  function dismissTemplateDeletion() {
    if (removeTemplate.isPending) return;
    removeTemplate.reset();
    setDeletingTemplate(false);
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={template.data.name} />
        <Menu
          visible={isMenuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              onPress={() => setMenuVisible(true)}
              accessibilityLabel={t("common.moreOptions")}
            />
          }
        >
          <Menu.Item
            leadingIcon="pencil-outline"
            title={t("templates.detail.rename")}
            onPress={() => {
              setMenuVisible(false);
              setRenaming(true);
            }}
          />
          <Menu.Item
            leadingIcon="delete-outline"
            title={t("templates.detail.delete")}
            onPress={() => {
              setMenuVisible(false);
              setDeletingTemplate(true);
            }}
          />
        </Menu>
      </ScreenAppBar>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={lines.isRefetching}
            onRefresh={() => void lines.refetch()}
          />
        }
      >
        {(template.data.isDefault === true ||
          (template.data.description !== undefined &&
            template.data.description.length > 0)) && (
          <View style={styles.identity}>
            {template.data.description !== undefined &&
              template.data.description.length > 0 && (
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {template.data.description}
                </Text>
              )}
            {template.data.isDefault === true && (
              <StateChip tint={financial.savings} icon="check-circle">
                {t("templates.form.default")}
              </StateChip>
            )}
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader title={t("templates.detail.summary")} />
          <LedgerCard>
            <TotalRow
              icon="arrow-down"
              tint={financial.income}
              label={t("templates.detail.income")}
              amount={totals.totalIncome}
              currency={currency}
            />
            <TotalRow
              icon="arrow-up"
              tint={financial.expense}
              label={t("templates.detail.outgoing")}
              amount={totals.totalExpenses}
              currency={currency}
            />
            <TotalRow
              icon="scale-balance"
              tint={
                totals.balance < 0 ? financial.overBudget : financial.savings
              }
              label={t("templates.detail.balance")}
              amount={totals.balance}
              currency={currency}
              isEmphasised
            />
          </LedgerCard>
        </View>

        {list.length === 0 ? (
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("templates.detail.empty")}
          </Text>
        ) : (
          <View
            pointerEvents={isUsageReady ? "auto" : "none"}
            style={styles.sections}
          >
            <TemplateLines
              lines={list}
              currency={currency}
              isDeleting={removeLine.isPending || !isUsageReady}
              onEdit={isUsageReady ? setEditedLine : () => undefined}
              onDelete={isUsageReady ? setDeletedLine : () => undefined}
            />
          </View>
        )}

        <ActionButton
          variant="secondary"
          icon="plus"
          disabled={!isUsageReady}
          onPress={() => setAdding(true)}
        >
          {t("templates.detail.addLine")}
        </ActionButton>

        {usage.isError && (
          <InlineQueryError
            message={t("templates.detail.usageError")}
            onRetry={() => void usage.refetch()}
          />
        )}

        {usage.data !== undefined && usage.data.budgets.length > 0 && (
          <View style={styles.usage}>
            <SectionHeader
              title={t("templates.detail.usageCount", {
                count: usage.data.budgets.length,
              })}
            />
            {/* A scrolling row of destinations, not a column of read-only text:
                twenty-five months printed one per line filled the screen with
                something nothing could be done with. Each one opens now. */}
            <View style={styles.usageMonths}>
              <FadingRail>
                {usage.data.budgets.map((budget) => (
                  <Chip
                    key={budget.id}
                    compact
                    onPress={() => router.push(`/budget/${budget.id}`)}
                  >
                    {formatMonthLabel(budget.month, budget.year, locale)}
                  </Chip>
                ))}
              </FadingRail>
            </View>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("templates.detail.usageHint")}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Mounted only while open: each sheet seeds its fields once, so one kept
          alive would reopen on the last thing that was typed into it. */}
      {isRenaming && (
        <TemplateFormSheet
          isVisible
          onDismiss={() => setRenaming(false)}
          template={template.data}
          onSaved={() => setRenaming(false)}
        />
      )}

      {isAdding && isUsageReady && (
        <TemplateLineSheet
          isVisible
          onDismiss={() => setAdding(false)}
          templateId={id}
          currency={currency}
          propagationCount={propagationCount}
          onSaved={() => setAdding(false)}
        />
      )}

      {editedLine !== null && isUsageReady && (
        <TemplateLineSheet
          isVisible
          onDismiss={() => setEditedLine(null)}
          templateId={id}
          currency={currency}
          propagationCount={propagationCount}
          line={editedLine}
          onSaved={() => setEditedLine(null)}
        />
      )}

      <Portal>
        <Dialog
          visible={deletedLine !== null && isUsageReady}
          onDismiss={dismissLineDeletion}
          dismissable={!removeLine.isPending}
        >
          <Dialog.Title>{t("templates.detail.deleteLineTitle")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t("templates.detail.deleteLineBody", {
                name: deletedLine?.name ?? "",
              })}
            </Text>
            {removeLine.isError && (
              <FieldError visible>
                {t("templates.detail.deleteLineError")}
              </FieldError>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={dismissLineDeletion}
              disabled={removeLine.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onPress={() => {
                if (deletedLine === null || !isUsageReady) return;
                removeLine.mutate(
                  { templateId: id, lineId: deletedLine.id },
                  { onSuccess: () => setDeletedLine(null) },
                );
              }}
              disabled={removeLine.isPending}
              loading={removeLine.isPending}
            >
              {t("templates.detail.confirmDelete")}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={isDeletingTemplate}
          onDismiss={dismissTemplateDeletion}
          dismissable={!removeTemplate.isPending}
        >
          <Dialog.Title>
            {t("templates.detail.deleteTemplateTitle")}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t("templates.detail.deleteTemplateBody", {
                name: template.data.name,
              })}
            </Text>
            {removeTemplate.isError && (
              <FieldError visible>
                {t("templates.detail.deleteTemplateError")}
              </FieldError>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={dismissTemplateDeletion}
              disabled={removeTemplate.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onPress={() =>
                removeTemplate.mutate(id, {
                  onSuccess: () => {
                    setDeletingTemplate(false);
                    router.back();
                  },
                })
              }
              disabled={removeTemplate.isPending}
              loading={removeTemplate.isPending}
            >
              {t("templates.detail.confirmDelete")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

function TotalRow({
  icon,
  tint,
  label,
  amount,
  currency,
  isEmphasised = false,
}: {
  icon: "arrow-down" | "arrow-up" | "scale-balance";
  tint: string;
  label: string;
  amount: number;
  currency: SupportedCurrency;
  isEmphasised?: boolean;
}) {
  return (
    <LedgerRow
      leading={<IconDisc name={icon} tint={tint} />}
      title={label}
      trailing={
        <Amount
          size={isEmphasised ? "row" : "meta"}
          style={isEmphasised ? { color: tint } : undefined}
        >
          {formatCompactCurrency(amount, currency)}
        </Amount>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xxl },
  identity: { gap: SPACING.sm },
  sections: { gap: SPACING.lg },
  section: { gap: SPACING.sm },
  usage: { gap: SPACING.sm },
  // The rail reaches the display edges from inside a gutter-padded scroll view,
  // then restores that gutter as its own content padding.
  usageMonths: { marginHorizontal: -SPACING.md },
});
