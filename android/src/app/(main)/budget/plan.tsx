import { router } from "expo-router";
import {
  getBudgetPeriodForDate,
  periodFromIndex,
  periodIndex,
  type BudgetPeriod,
  type BudgetTemplate,
} from "pulpe-shared";
import { useEffect, useMemo, useState } from "react";
import { BackHandler, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Divider,
  Menu,
  RadioButton,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "@/core/i18n/locale-store";
import { FieldError } from "@/core/ui/field-error";
import { formatMonthName } from "@/core/ui/date-format";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import { RADIUS, SPACING } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { useGenerateBudgets } from "@/features/budgets/generate-budgets-mutation";
import { useTemplates } from "@/features/templates/template-queries";

const DEFAULT_PERIOD_COUNT = 12;
const MAXIMUM_PERIOD_COUNT = 36;
const YEAR_OPTION_COUNT = 4;
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export default function PlanBudgetsScreen() {
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const settings = useUserSettings();
  const templates = useTemplates();
  const generate = useGenerateBudgets();
  const now = useMemo(() => new Date(), []);
  const [chosenStart, setChosenStart] = useState<BudgetPeriod | null>(null);
  const [chosenEnd, setChosenEnd] = useState<BudgetPeriod | null>(null);
  const [chosenTemplateId, setChosenTemplateId] = useState<string | null>(null);

  const defaultStart = getBudgetPeriodForDate(
    now,
    settings.data?.payDayOfMonth,
  );
  const start = chosenStart ?? defaultStart;
  const end =
    chosenEnd ?? periodFromIndex(periodIndex(start) + DEFAULT_PERIOD_COUNT - 1);
  const count = periodIndex(end) - periodIndex(start) + 1;
  const selectedTemplateId =
    chosenTemplateId ?? defaultTemplateId(templates.data ?? []);
  const startYears = Array.from(
    { length: YEAR_OPTION_COUNT },
    (_, index) => defaultStart.year + index,
  );
  const endYears = Array.from(
    { length: YEAR_OPTION_COUNT },
    (_, index) => start.year + index,
  );
  const validationMessage =
    count < 1
      ? t("budgets.plan.rangeOrderError")
      : count > MAXIMUM_PERIOD_COUNT
        ? t("budgets.plan.rangeLimitError")
        : null;
  const isLoading = settings.isPending || templates.isPending;
  const hasLoadError =
    settings.isError || templates.isError || settings.data === undefined;
  const hasNoTemplates =
    !isLoading && !hasLoadError && templates.data?.length === 0;

  useEffect(() => {
    if (!generate.isPending) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => subscription.remove();
  }, [generate.isPending]);

  function submit() {
    if (selectedTemplateId === null || validationMessage !== null) return;
    generate.mutate(
      {
        templateId: selectedTemplateId,
        startMonth: start.month,
        startYear: start.year,
        count,
      },
      {
        onSuccess: (response) =>
          router.replace({
            pathname: "/budgets",
            params: {
              createdCount: String(response.data.budgets.length),
              skippedCount: String(response.data.skippedMonths.length),
            },
          }),
      },
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
          disabled={generate.isPending}
          accessibilityLabel={t("common.back")}
        />
        <Appbar.Content title={t("budgets.plan.title")} />
      </ScreenAppBar>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel={t("common.loading")} />
        </View>
      ) : hasLoadError ? (
        <View style={styles.centered}>
          <Text variant="titleMedium">{t("budgets.plan.loadErrorTitle")}</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>
            {t("budgets.plan.loadErrorHint")}
          </Text>
          <Button
            mode="contained"
            onPress={() =>
              void Promise.all([settings.refetch(), templates.refetch()])
            }
          >
            {t("common.retry")}
          </Button>
        </View>
      ) : hasNoTemplates ? (
        <View style={styles.centered}>
          <Text variant="titleMedium">
            {t("budgets.plan.noTemplatesTitle")}
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>
            {t("budgets.plan.noTemplatesHint")}
          </Text>
          <Button mode="contained" onPress={() => router.replace("/templates")}>
            {t("budgets.plan.viewTemplates")}
          </Button>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <PeriodField
              label={t("budgets.plan.from")}
              period={start}
              years={startYears}
              locale={locale}
              monthAccessibilityLabel={t("budgets.plan.monthAccessibility", {
                field: t("budgets.plan.from"),
              })}
              yearAccessibilityLabel={t("budgets.plan.yearAccessibility", {
                field: t("budgets.plan.from"),
              })}
              onChange={setChosenStart}
            />
            <PeriodField
              label={t("budgets.plan.to")}
              period={end}
              years={endYears}
              locale={locale}
              monthAccessibilityLabel={t("budgets.plan.monthAccessibility", {
                field: t("budgets.plan.to"),
              })}
              yearAccessibilityLabel={t("budgets.plan.yearAccessibility", {
                field: t("budgets.plan.to"),
              })}
              onChange={setChosenEnd}
            />

            {validationMessage === null && (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("budgets.plan.periodCount", { count })}
              </Text>
            )}
            {validationMessage !== null && (
              <FieldError visible>{validationMessage}</FieldError>
            )}

            <Text variant="titleSmall">{t("budgets.plan.template")}</Text>
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
                        ? `${template.name} · ${t("budgets.plan.default")}`
                        : template.name
                    }
                    position="leading"
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
              {t("budgets.plan.existingHint")}
            </Text>
          </ScrollView>

          <Divider />
          <View style={styles.footer}>
            {generate.isError && (
              <FieldError visible>{t("budgets.plan.error")}</FieldError>
            )}
            <Button
              mode="contained"
              onPress={submit}
              disabled={
                selectedTemplateId === null ||
                validationMessage !== null ||
                generate.isPending
              }
              loading={generate.isPending}
              accessibilityLabel={t("budgets.plan.submit")}
            >
              {t("budgets.plan.submit")}
            </Button>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function PeriodField({
  label,
  period,
  years,
  locale,
  monthAccessibilityLabel,
  yearAccessibilityLabel,
  onChange,
}: {
  label: string;
  period: BudgetPeriod;
  years: number[];
  locale: string;
  monthAccessibilityLabel: string;
  yearAccessibilityLabel: string;
  onChange: (period: BudgetPeriod) => void;
}) {
  const [monthMenuVisible, setMonthMenuVisible] = useState(false);
  const [yearMenuVisible, setYearMenuVisible] = useState(false);

  return (
    <View style={styles.field}>
      <Text variant="titleSmall">{label}</Text>
      <View style={styles.pickers}>
        <Menu
          visible={monthMenuVisible}
          onDismiss={() => setMonthMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              icon="menu-down"
              contentStyle={styles.pickerButton}
              onPress={() => setMonthMenuVisible(true)}
              accessibilityLabel={monthAccessibilityLabel}
            >
              {formatMonthName(period.month, period.year, locale)}
            </Button>
          }
        >
          {MONTHS.map((month) => (
            <Menu.Item
              key={month}
              title={formatMonthName(month, period.year, locale)}
              onPress={() => {
                onChange({ ...period, month });
                setMonthMenuVisible(false);
              }}
            />
          ))}
        </Menu>

        <Menu
          visible={yearMenuVisible}
          onDismiss={() => setYearMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              icon="menu-down"
              contentStyle={styles.pickerButton}
              onPress={() => setYearMenuVisible(true)}
              accessibilityLabel={yearAccessibilityLabel}
            >
              {String(period.year)}
            </Button>
          }
        >
          {years.map((year) => (
            <Menu.Item
              key={year}
              title={String(year)}
              onPress={() => {
                onChange({ ...period, year });
                setYearMenuVisible(false);
              }}
            />
          ))}
        </Menu>
      </View>
    </View>
  );
}

function defaultTemplateId(templates: BudgetTemplate[]): string | null {
  const preferred =
    templates.find((template) => template.isDefault === true) ?? templates[0];
  return preferred?.id ?? null;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  content: { padding: SPACING.md, gap: SPACING.lg },
  field: { gap: SPACING.sm },
  pickers: { flexDirection: "row", gap: SPACING.sm },
  pickerButton: { minHeight: 48 },
  templates: { gap: SPACING.sm },
  templateLabel: { textAlign: "left" },
  template: { borderRadius: RADIUS.card, borderWidth: 1 },
  footer: { padding: SPACING.md, gap: SPACING.sm },
});
