import { router, useLocalSearchParams } from "expo-router";
import {
  BudgetFormulas,
  type SupportedCurrency,
  type TemplateLine,
} from "pulpe-shared";
import { useMemo, useState } from "react";
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
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { Notice } from "@/core/ui/notice";
import { SectionHeader } from "@/core/ui/section-header";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";

import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthLabel, formatMonthName } from "@/core/ui/date-format";
import { FadingRail } from "@/core/ui/fading-rail";
import { InlineQueryError } from "@/core/ui/inline-query-error";
import { FieldError } from "@/core/ui/field-error";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { Amount } from "@/core/ui/amount";
import { RADIUS, SPACING } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
import { useNow } from "@/features/current-month/current-month-queries";
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
import {
  propagationBudgetCount,
  propagationCurrentPeriod,
} from "@/features/templates/template-vm";
import { useSavingsGoals } from "@/features/savings-goals/goals-queries";

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
  // The reach of an edit follows the payday period, so it is read again on
  // midnight and on return to the foreground, not frozen at mount.
  const [now, readClock] = useNow();
  const pull = usePullToRefresh(() => {
    readClock();
    return lines.refetch();
  });
  const usage = useTemplateUsage(id);
  const goals = useSavingsGoals();
  const goalIds = useMemo(
    () => new Set((goals.data ?? []).map((goal) => goal.id)),
    [goals.data],
  );
  const [toast, setToast] = useState<string | null>(null);
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

  if (
    (template.isError && template.data === undefined) ||
    (lines.isError && lines.data === undefined) ||
    (settings.isError && settings.data === undefined)
  ) {
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
  const financialOverBudget = financial.overBudget;
  const isUsageReady = usage.data !== undefined && !usage.isError;
  const propagationCount = isUsageReady
    ? propagationBudgetCount(usage.data, settings.data?.payDayOfMonth, now)
    : 0;
  const currentPeriod = isUsageReady
    ? propagationCurrentPeriod(usage.data, settings.data?.payDayOfMonth, now)
    : null;
  const propagationMonth =
    currentPeriod === null
      ? null
      : formatMonthName(currentPeriod.month, currentPeriod.year, locale);
  const usedBudgetCount = isUsageReady ? usage.data.budgets.length : null;
  const subtitle = [
    template.data.isDefault === true
      ? t("templates.detail.defaultLabel")
      : null,
    template.data.isDefault !== true && (template.data.description ?? "") !== ""
      ? template.data.description
      : null,
    usedBudgetCount === null
      ? null
      : usedBudgetCount === 0
        ? t("templates.detail.neverUsed")
        : t("templates.detail.usedFor", { count: usedBudgetCount }),
  ]
    .filter((part) => part !== null)
    .join(" · ");
  const savedLine = (updatedBudgets: number) => {
    setToast(
      updatedBudgets > 0
        ? t("templates.lines.updated", { count: updatedBudgets })
        : t("templates.lines.updatedTemplateOnly"),
    );
  };

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
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel={t("common.back")}
        />
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
        </Menu>
      </ScreenAppBar>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl {...pull} />}
      >
        {subtitle !== "" && (
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {subtitle}
          </Text>
        )}

        <View style={[styles.hero, { backgroundColor: theme.colors.surface }]}>
          <Text
            variant="labelLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("templates.detail.heroLabel")}
          </Text>
          <Amount
            size="hero"
            style={
              totals.balance < 0 ? { color: financialOverBudget } : undefined
            }
          >
            {formatCurrency(totals.balance, currency)}
          </Amount>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("templates.detail.heroSentence", {
              income: formatCurrency(totals.totalIncome, currency),
            })}
          </Text>
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
              goalIds={goalIds}
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

        <View style={styles.section}>
          <SectionHeader title={t("templates.detail.deleteSection")} />
          <LedgerCard>
            <LedgerRow
              title={t("templates.detail.delete")}
              subtitle={
                usedBudgetCount === null
                  ? t("templates.detail.deleteChecking")
                  : usedBudgetCount === 0
                    ? t("templates.detail.deleteFree")
                    : t("templates.detail.deleteBlocked", {
                        count: usedBudgetCount,
                      })
              }
              isPending={usedBudgetCount !== 0}
              onPress={
                usedBudgetCount === 0
                  ? () => setDeletingTemplate(true)
                  : undefined
              }
            />
          </LedgerCard>
        </View>
      </ScrollView>

      <Notice
        visible={toast !== null}
        onDismiss={() => setToast(null)}
        duration={4000}
      >
        {toast}
      </Notice>

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
          templateName={template.data.name}
          propagationCount={propagationCount}
          propagationMonth={propagationMonth}
          onSaved={() => setAdding(false)}
        />
      )}

      {editedLine !== null && isUsageReady && (
        <TemplateLineSheet
          isVisible
          onDismiss={() => setEditedLine(null)}
          templateId={id}
          currency={currency}
          templateName={template.data.name}
          propagationCount={propagationCount}
          propagationMonth={propagationMonth}
          line={editedLine}
          onSaved={(outcome) => {
            setEditedLine(null);
            savedLine(outcome.updatedBudgets);
          }}
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xxl },
  hero: { borderRadius: RADIUS.card, padding: SPACING.lg, gap: SPACING.xs },
  sections: { gap: SPACING.lg },
  section: { gap: SPACING.sm },
  usage: { gap: SPACING.sm },
  // The rail reaches the display edges from inside a gutter-padded scroll view,
  // then restores that gutter as its own content padding.
  usageMonths: { marginHorizontal: -SPACING.md },
});
