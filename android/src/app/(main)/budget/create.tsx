import { router } from "expo-router";
import type { BudgetTemplate } from "pulpe-shared";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Divider,
  RadioButton,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenAppBar } from "@/core/ui/screen-app-bar";

import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatMonthLabel, formatMonthName } from "@/core/ui/date-format";
import { FilterChip } from "@/core/ui/filter-chip";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { RADIUS, SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";
import { useTranslation } from "@/core/i18n/locale-store";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import {
  availableMonths,
  type BudgetPeriod,
} from "@/features/budgets/available-months";
import { useCreateBudget } from "@/features/budgets/create-budget-mutation";
import { useBudgetList } from "@/features/budgets/budget-queries";
import { useTemplates } from "@/features/templates/template-queries";

/**
 * How many free months the picker offers. Beyond a quarter ahead the choice
 * stops being a choice and becomes a list to scroll — and a budget built that
 * far out is built from a template that will have changed by then anyway.
 */
const PERIODS_OFFERED = 3;

export default function CreateBudgetScreen() {
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const budgets = useBudgetList();
  const templates = useTemplates();
  const settings = useUserSettings();
  const create = useCreateBudget();
  const [chosenPeriodKey, setChosenPeriodKey] = useState<string | null>(null);
  const [chosenTemplateId, setChosenTemplateId] = useState<string | null>(null);

  const periods = availableMonths(
    budgets.data ?? [],
    new Date(),
    PERIODS_OFFERED,
    settings.data?.payDayOfMonth,
  );
  // Derived rather than synced from an effect: both lists arrive after the
  // first render, and a default written into state then would overwrite a
  // choice the user had already made in between.
  const period =
    periods.find((candidate) => periodKey(candidate) === chosenPeriodKey) ??
    periods[0] ??
    null;
  const selectedTemplateId =
    chosenTemplateId ?? defaultTemplateId(templates.data ?? []);

  if (budgets.isPending || templates.isPending || settings.isPending) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </SafeAreaView>
    );
  }

  if (budgets.isError || templates.isError || settings.isError) {
    return (
      <PlaceholderScreen
        icon="cloud-off-outline"
        title={t("budgets.create.loadErrorTitle")}
        hint={t("budgets.create.loadErrorHint")}
        action={{
          label: t("common.retry"),
          onPress: () =>
            void Promise.all([
              budgets.refetch(),
              templates.refetch(),
              settings.refetch(),
            ]),
        }}
      />
    );
  }

  if (period === null) {
    return (
      <PlaceholderScreen
        icon="calendar-check-outline"
        title={t("budgets.create.noMonthsTitle")}
        hint={t("budgets.create.noMonthsHint")}
        action={{ label: t("common.back"), onPress: () => router.back() }}
      />
    );
  }

  if ((templates.data ?? []).length === 0) {
    return (
      <PlaceholderScreen
        icon="file-document-outline"
        title={t("budgets.create.noTemplatesTitle")}
        hint={t("budgets.create.noTemplatesHint")}
        action={{
          label: t("budgets.create.viewTemplates"),
          onPress: () => router.replace("/templates"),
        }}
      />
    );
  }

  function submit() {
    if (selectedTemplateId === null || period === null) return;
    create.mutate(
      {
        month: period.month,
        year: period.year,
        description: formatMonthName(period.month, period.year, locale),
        templateId: selectedTemplateId,
      },
      { onSuccess: () => router.back() },
    );
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
        <Appbar.Content title={t("budgets.create.title")} />
      </ScreenAppBar>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleSmall">{t("budgets.create.month")}</Text>
        <View style={styles.periods}>
          {periods.map((candidate) => (
            <FilterChip
              key={periodKey(candidate)}
              selected={periodKey(candidate) === periodKey(period)}
              onPress={() => setChosenPeriodKey(periodKey(candidate))}
            >
              {/* Year included: an account already booked to January is offered
                  February, March and April of the *next* year, and three bare
                  month names give no hint of that. */}
              {formatMonthLabel(candidate.month, candidate.year, locale)}
            </FilterChip>
          ))}
        </View>

        <Text variant="titleSmall">{t("budgets.create.template")}</Text>

        <RadioButton.Group
          value={selectedTemplateId ?? ""}
          onValueChange={setChosenTemplateId}
        >
          <View style={styles.templates}>
            {(templates.data ?? []).map((template) => (
              <RadioButton.Item
                key={template.id}
                value={template.id}
                label={
                  template.isDefault === true
                    ? `${template.name} · ${t("budgets.create.default")}`
                    : template.name
                }
                position="leading"
                // Paper right-aligns the label of a leading radio, which leaves
                // the name floating a screen away from the button that picks it.
                labelStyle={styles.templateLabel}
                style={[
                  styles.template,
                  {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderColor:
                      template.id === selectedTemplateId
                        ? theme.colors.primary
                        : "transparent",
                  },
                ]}
              />
            ))}
          </View>
        </RadioButton.Group>

        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("budgets.create.description")}
        </Text>
      </ScrollView>

      {/* Pinned, not scrolled: an account with half a dozen models pushes its
          own create button below the fold, on the one screen whose whole
          purpose is to press it. */}
      <Divider />
      <View style={styles.footer}>
        {create.isError && (
          <FieldError visible>{t("budgets.create.error")}</FieldError>
        )}

        <Button
          mode="contained"
          onPress={submit}
          disabled={selectedTemplateId === null || create.isPending}
          loading={create.isPending}
        >
          {t("budgets.create.submit")}
        </Button>
      </View>
    </SafeAreaView>
  );
}

function periodKey(period: BudgetPeriod): string {
  return `${period.year}-${period.month}`;
}

/** The template the account marked default, or simply the first one it has. */
function defaultTemplateId(templates: BudgetTemplate[]): string | null {
  const preferred =
    templates.find((template) => template.isDefault === true) ?? templates[0];
  return preferred?.id ?? null;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.md, gap: SPACING.md },
  footer: { padding: SPACING.md, gap: SPACING.sm },
  periods: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  templates: { gap: SPACING.sm },
  templateLabel: { textAlign: "left" },
  template: { borderRadius: RADIUS.card, borderWidth: 1 },
});
