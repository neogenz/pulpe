import { router } from "expo-router";
import type { BudgetTemplate } from "pulpe-shared";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  HelperText,
  RadioButton,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatMonthName } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { RADIUS, SPACING } from "@/core/ui/theme";
import { useCreateBudget } from "@/features/budgets/create-budget-mutation";
import { nextAvailableMonth } from "@/features/budgets/next-available-month";
import { useBudgetPeriods } from "@/features/budgets/budget-queries";
import { useTemplates } from "@/features/templates/template-queries";

export default function CreateNextBudgetScreen() {
  const theme = useTheme();
  const periods = useBudgetPeriods();
  const templates = useTemplates();
  const create = useCreateBudget();
  const [chosenTemplateId, setChosenTemplateId] = useState<string | null>(null);

  const period =
    periods.data === undefined
      ? null
      : nextAvailableMonth(periods.data, new Date());
  // Derived rather than synced from an effect: the list arrives after the first
  // render, and a default written into state then would overwrite a choice the
  // user had already made in between.
  const selectedTemplateId =
    chosenTemplateId ?? defaultTemplateId(templates.data ?? []);

  if (periods.isPending || templates.isPending) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (period === null) {
    return (
      <PlaceholderScreen
        title="Tes prochains mois sont déjà prêts"
        hint="Reviens quand tu voudras en préparer un de plus."
        action={{ label: "Revenir", onPress: () => router.back() }}
      />
    );
  }

  if ((templates.data ?? []).length === 0) {
    return (
      <PlaceholderScreen
        title="Pas encore de modèle"
        hint="Un budget se crée depuis un modèle. Crée-en un d'abord."
        action={{
          label: "Voir mes modèles",
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
        description: formatMonthName(period.month, period.year),
        templateId: selectedTemplateId,
      },
      { onSuccess: () => router.back() },
    );
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Nouveau budget" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <Card mode="contained">
          <Card.Content style={styles.periodCard}>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Période du budget
            </Text>
            <Text variant="titleLarge" style={styles.period}>
              {formatMonthName(period.month, period.year)}
            </Text>
          </Card.Content>
        </Card>

        <Text variant="titleSmall">Choisir un modèle</Text>

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
                    ? `${template.name} · par défaut`
                    : template.name
                }
                position="leading"
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
          Le budget sera créé avec les prévisions du modèle sélectionné.
        </Text>

        {create.isError && (
          <HelperText type="error" visible>
            Le budget n&apos;a pas pu être créé. Réessaie.
          </HelperText>
        )}

        <Button
          mode="contained"
          onPress={submit}
          disabled={selectedTemplateId === null || create.isPending}
          loading={create.isPending}
        >
          Créer le budget
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
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
  periodCard: { gap: SPACING.xs },
  period: { textTransform: "capitalize" },
  templates: { gap: SPACING.sm },
  template: { borderRadius: RADIUS.card, borderWidth: 1 },
});
