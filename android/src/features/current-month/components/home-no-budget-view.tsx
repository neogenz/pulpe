import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import {
  type BudgetPeriodDates,
  BudgetFormulas,
  type SupportedCurrency,
} from "pulpe-shared";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { ActionButton } from "@/core/ui/action-button";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatDayMonth } from "@/core/ui/date-format";
import { FieldError } from "@/core/ui/field-error";
import { useV2Colors } from "@/core/ui/scheme-colors";
import { ICON_SIZE, RADIUS, SPACING } from "@/core/ui/theme";
import { useCreateBudget } from "@/features/budgets/create-budget-mutation";
import {
  useTemplateLines,
  useTemplates,
} from "@/features/templates/template-queries";

interface HomeNoBudgetViewProps {
  month: number;
  year: number;
  /** The lowercase name the button says: « Créer le budget de novembre ». */
  monthName: string;
  period: BudgetPeriodDates;
  currency: SupportedCurrency;
}

/**
 * The home of a month that has no budget yet: what the default template would
 * plan, then « Créer le budget de … » in one tap. Another template is one link
 * away. `HomeNoBudgetView` on iOS.
 */
export function HomeNoBudgetView({
  month,
  year,
  monthName,
  period,
  currency,
}: HomeNoBudgetViewProps) {
  const theme = useTheme();
  const v2 = useV2Colors();
  const { locale, t } = useTranslation();
  const templates = useTemplates();
  const create = useCreateBudget();
  const template =
    templates.data?.find((candidate) => candidate.isDefault === true) ??
    templates.data?.[0];
  const lines = useTemplateLines(template?.id ?? "");
  const items = template === undefined ? undefined : lines.data;
  const sum = (kind: "expense" | "saving") =>
    (items ?? [])
      .filter((line) => line.kind === kind)
      .reduce((total, line) => total + line.amount, 0);
  const totals = BudgetFormulas.calculateTemplateTotals(items ?? []);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text
        variant="bodyLarge"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {t("home.noBudget.period", {
          start: formatDayMonth(period.startDate, locale),
          end: formatDayMonth(period.endDate, locale),
        })}
      </Text>

      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.disc, { backgroundColor: v2.accentWash }]}>
          <MaterialCommunityIcons
            name="calendar-blank-outline"
            size={ICON_SIZE.xl}
            color={v2.accentInk}
          />
        </View>
        <Text
          variant="titleLarge"
          accessibilityRole="header"
          style={styles.centered}
        >
          {t("home.states.emptyTitle")}
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.centered, { color: theme.colors.onSurfaceVariant }]}
        >
          {t("home.states.emptyHint")}
        </Text>

        {items === undefined || template === undefined ? (
          <ActivityIndicator accessibilityLabel={t("common.loading")} />
        ) : (
          <View style={styles.summary}>
            <View style={styles.row}>
              <Text variant="titleMedium">{template.name}</Text>
              {template.isDefault === true && (
                <Text
                  variant="labelLarge"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("home.noBudget.default")}
                </Text>
              )}
            </View>
            {(
              [
                ["income", totals.totalIncome],
                ["expenses", sum("expense")],
                ["savings", sum("saving")],
                ["available", totals.balance],
              ] as const
            ).map(([key, amount]) => (
              <View
                key={key}
                style={[
                  styles.row,
                  { borderTopColor: theme.colors.outlineVariant },
                  styles.ruled,
                ]}
              >
                <Text
                  variant={key === "available" ? "titleMedium" : "bodyLarge"}
                >
                  {t(`home.noBudget.${key}`)}
                </Text>
                <Text variant="titleMedium" style={styles.amount}>
                  {formatCurrency(amount, currency)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <ActionButton
          testID="home-create-budget"
          loading={create.isPending}
          disabled={template === undefined || create.isPending}
          onPress={() => {
            if (template === undefined) return;
            create.mutate({
              month,
              year,
              description: monthName,
              templateId: template.id,
            });
          }}
        >
          {t("home.states.createBudget", { month: monthName })}
        </ActionButton>
        <Button
          testID="home-other-template"
          mode="text"
          disabled={create.isPending}
          onPress={() =>
            router.push({
              pathname: "/budget/create",
              params: { month: String(month), year: String(year) },
            })
          }
        >
          {t("home.noBudget.otherTemplate")}
        </Button>
        {create.isError && <FieldError>{t("budgets.create.error")}</FieldError>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xl },
  card: { borderRadius: RADIUS.zone, padding: SPACING.lg, gap: SPACING.md },
  disc: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: { textAlign: "center" },
  summary: { gap: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
  },
  ruled: { borderTopWidth: StyleSheet.hairlineWidth },
  amount: { fontVariant: ["tabular-nums"] },
  actions: { gap: SPACING.sm },
});
