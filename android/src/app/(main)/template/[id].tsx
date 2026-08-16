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

import { Card } from "@/core/ui/card";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";

import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { formatMonthLabel } from "@/core/ui/date-format";
import { FadingRail } from "@/core/ui/fading-rail";
import { InlineQueryError } from "@/core/ui/inline-query-error";
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

  if (template.isPending || lines.isPending) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator accessibilityLabel="Chargement" />
      </SafeAreaView>
    );
  }

  if (template.isError || lines.isError) {
    return (
      <PlaceholderScreen
        icon="cloud-off-outline"
        title="On n'a pas pu charger ce modèle"
        hint="Vérifie ta connexion, puis réessaie."
        action={{
          label: "Réessayer",
          onPress: () =>
            void Promise.all([template.refetch(), lines.refetch()]),
        }}
      />
    );
  }

  if (template.data === undefined) {
    return (
      <PlaceholderScreen
        icon="file-remove-outline"
        title="Ce modèle n'existe plus"
        hint="Il a peut-être été supprimé depuis un autre appareil."
        action={{ label: "Revenir", onPress: () => router.back() }}
      />
    );
  }

  const list = lines.data ?? [];
  const totals = BudgetFormulas.calculateTemplateTotals(list);
  const isUsageReady = usage.data !== undefined && !usage.isError;
  const propagationCount = isUsageReady
    ? propagationBudgetCount(usage.data)
    : 0;

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
              accessibilityLabel="Plus d'options"
            />
          }
        >
          <Menu.Item
            leadingIcon="pencil-outline"
            title="Renommer"
            onPress={() => {
              setMenuVisible(false);
              setRenaming(true);
            }}
          />
          <Menu.Item
            leadingIcon="delete-outline"
            title="Supprimer le modèle"
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
        {template.data.isDefault === true && (
          <View style={styles.badgeRow}>
            <Chip compact icon="star">
              Modèle par défaut
            </Chip>
          </View>
        )}

        <Card mode="contained">
          <Card.Content style={styles.totals}>
            <TotalRow
              label="Revenus"
              amount={totals.totalIncome}
              currency={currency}
            />
            <TotalRow
              label="Dépenses et épargne"
              amount={totals.totalExpenses}
              currency={currency}
            />
            <TotalRow
              label="Reste"
              amount={totals.balance}
              currency={currency}
              isEmphasised
            />
          </Card.Content>
        </Card>

        {list.length === 0 ? (
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Ce modèle est encore vide. Ajoute tes revenus, tes charges et ton
            épargne pour qu&apos;il puisse servir de mois type.
          </Text>
        ) : (
          <View pointerEvents={isUsageReady ? "auto" : "none"}>
            <TemplateLines
              lines={list}
              currency={currency}
              isDeleting={removeLine.isPending || !isUsageReady}
              onEdit={isUsageReady ? setEditedLine : () => undefined}
              onDelete={isUsageReady ? setDeletedLine : () => undefined}
            />
          </View>
        )}

        <Button
          mode="outlined"
          icon="plus"
          disabled={!isUsageReady}
          onPress={() => setAdding(true)}
        >
          Ajouter une prévision
        </Button>

        {usage.isError && (
          <InlineQueryError
            message="Impossible de vérifier les budgets liés à ce modèle."
            onRetry={() => void usage.refetch()}
          />
        )}

        {usage.data !== undefined && usage.data.budgets.length > 0 && (
          <View style={styles.usage}>
            <Text variant="titleSmall">
              {`${usage.data.budgets.length} budgets créés depuis ce modèle`}
            </Text>
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
                    {formatMonthLabel(budget.month, budget.year)}
                  </Chip>
                ))}
              </FadingRail>
            </View>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Supprimer le modèle ne touche pas ces budgets.
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
          onDismiss={() => setDeletedLine(null)}
        >
          <Dialog.Title>Supprimer cette prévision ?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              « {deletedLine?.name} » quittera le modèle. Les budgets déjà créés
              gardent la leur.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeletedLine(null)}>Annuler</Button>
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
              Supprimer
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={isDeletingTemplate}
          onDismiss={() => setDeletingTemplate(false)}
        >
          <Dialog.Title>Supprimer ce modèle ?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Les budgets déjà créés depuis « {template.data.name} » restent
              intacts. Seul le modèle disparaît.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeletingTemplate(false)}>Annuler</Button>
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
              Supprimer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

function TotalRow({
  label,
  amount,
  currency,
  isEmphasised = false,
}: {
  label: string;
  amount: number;
  currency: SupportedCurrency;
  isEmphasised?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.totalRow}>
      <Text
        variant={isEmphasised ? "titleSmall" : "bodyMedium"}
        style={
          isEmphasised ? undefined : { color: theme.colors.onSurfaceVariant }
        }
      >
        {label}
      </Text>
      <Amount size={isEmphasised ? "row" : "meta"}>
        {formatCompactCurrency(amount, currency)}
      </Amount>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  badgeRow: { flexDirection: "row" },
  totals: { gap: SPACING.xs },
  totalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  usage: { gap: SPACING.sm },
  // The rail reaches the display edges from inside a gutter-padded scroll view,
  // then restores that gutter as its own content padding.
  usageMonths: { marginHorizontal: -SPACING.md },
});
