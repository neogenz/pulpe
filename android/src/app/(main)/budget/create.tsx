import { router } from "expo-router";
import type { BudgetTemplate } from "pulpe-shared";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Chip,
  Divider,
  HelperText,
  RadioButton,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenAppBar } from "@/core/ui/screen-app-bar";

import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatMonthLabel, formatMonthName } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { RADIUS, SPACING } from "@/core/ui/theme";
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
  const budgets = useBudgetList();
  const templates = useTemplates();
  const create = useCreateBudget();
  const [chosenPeriodKey, setChosenPeriodKey] = useState<string | null>(null);
  const [chosenTemplateId, setChosenTemplateId] = useState<string | null>(null);

  const periods = availableMonths(
    budgets.data ?? [],
    new Date(),
    PERIODS_OFFERED,
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

  if (budgets.isPending || templates.isPending) {
    return (
      <SafeAreaView
        edges={["bottom"]}
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
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Nouveau budget" />
      </ScreenAppBar>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleSmall">Quel mois</Text>
        <View style={styles.periods}>
          {periods.map((candidate) => (
            <Chip
              key={periodKey(candidate)}
              selected={periodKey(candidate) === periodKey(period)}
              showSelectedCheck={false}
              onPress={() => setChosenPeriodKey(periodKey(candidate))}
            >
              {/* Year included: an account already booked to January is offered
                  February, March and April of the *next* year, and three bare
                  month names give no hint of that. */}
              {formatMonthLabel(candidate.month, candidate.year)}
            </Chip>
          ))}
        </View>

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
          Le budget sera créé avec les prévisions du modèle sélectionné.
        </Text>
      </ScrollView>

      {/* Pinned, not scrolled: an account with half a dozen models pushes its
          own create button below the fold, on the one screen whose whole
          purpose is to press it. */}
      <Divider />
      <View style={styles.footer}>
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
