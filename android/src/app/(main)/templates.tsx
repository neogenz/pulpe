import { router } from "expo-router";
import type { BudgetTemplate } from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Card,
  Chip,
  FAB,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { SPACING } from "@/core/ui/theme";
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
  const theme = useTheme();
  const templates = useTemplates();
  const [isCreating, setCreating] = useState(false);

  if (templates.isPending) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (templates.isError) {
    return (
      <PlaceholderScreen
        title="On n'a pas pu charger tes modèles"
        hint="Vérifie ta connexion, puis réessaie."
        action={{ label: "Réessayer", onPress: () => void templates.refetch() }}
      />
    );
  }

  const list = templates.data ?? [];
  const canAdd = canCreateTemplate(list.length);

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      {list.length === 0 ? (
        <PlaceholderScreen
          title="Crée ton premier modèle"
          hint="Un mois type : tes revenus, tes charges et ton épargne, prêts à être rejoués."
          action={{
            label: "Créer un modèle",
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
            <Text variant="headlineSmall">Modèles</Text>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {list.length}/{MAX_TEMPLATES} modèles
            </Text>
          </View>

          {list.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}

          {!canAdd && (
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Tu as atteint la limite de {MAX_TEMPLATES} modèles. Supprimes-en
              un pour en créer un autre.
            </Text>
          )}
        </ScrollView>
      )}

      {list.length > 0 && canAdd && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => setCreating(true)}
          accessibilityLabel="Ajouter un modèle"
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
          {template.isDefault === true && <Chip compact>Par défaut</Chip>}
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
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
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
