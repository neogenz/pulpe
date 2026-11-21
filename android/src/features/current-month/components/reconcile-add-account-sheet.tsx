import type { Asset } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { useRipple } from "@/core/ui/ripple";
import { FormModal } from "@/core/ui/sheet";
import { RADIUS, SPACING, TOUCH_TARGET } from "@/core/ui/theme";

import type { AddableGroup, RowSide } from "../reconcile-account-links";

export type AddAccountChoice =
  | { kind: "free"; side: RowSide }
  | { kind: "asset"; asset: Asset };

interface ReconcileAddAccountSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  onChoose: (choice: AddAccountChoice) => void;
  /** Empty hides « Depuis Mon patrimoine »: flag off, or nothing left to add. */
  groups: AddableGroup[];
}

/**
 * « Ajouter un compte »: a new free row, a sum I owe, or an item of « Mon
 * patrimoine » whose balance follows what I type. Picking one adds the row.
 */
export function ReconcileAddAccountSheet({
  isVisible,
  onDismiss,
  onChoose,
  groups,
}: ReconcileAddAccountSheetProps) {
  const theme = useTheme();
  const ripple = useRipple();
  const { t } = useTranslation();
  const muted = { color: theme.colors.onSurfaceVariant };
  const options = [
    { side: "own", title: "newTitle", hint: "newHint", icon: "plus" },
    { side: "owe", title: "oweTitle", hint: "oweHint", icon: "minus" },
  ] as const;

  return (
    <FormModal
      isVisible={isVisible}
      onDismiss={onDismiss}
      title={t("home.reconcile.accounts.add.title")}
    >
      <Text variant="bodyMedium" style={muted} textBreakStrategy="balanced">
        {t("home.reconcile.accounts.add.intro")}
      </Text>
      {options.map(({ side, title, hint, icon }) => (
        <Pressable
          key={side}
          accessibilityRole="button"
          android_ripple={ripple}
          onPress={() => onChoose({ kind: "free", side })}
          testID={`reconcile-add-${side}`}
          style={[
            styles.option,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Icon source={icon} size={24} color={theme.colors.primary} />
          <View style={styles.grow}>
            <Text variant="bodyLarge">
              {t(`home.reconcile.accounts.add.${title}`)}
            </Text>
            <Text variant="bodySmall" style={muted}>
              {t(`home.reconcile.accounts.add.${hint}`)}
            </Text>
          </View>
        </Pressable>
      ))}
      {groups.length > 0 && (
        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <Text variant="titleSmall" accessibilityRole="header">
              {t("home.reconcile.accounts.add.fromNetWorth")}
            </Text>
            <Text variant="bodySmall" style={muted}>
              {t("home.reconcile.accounts.add.fromNetWorthHint")}
            </Text>
          </View>
          {groups.map((group) => (
            <View key={group.id}>
              <Text variant="labelLarge" style={muted}>
                {group.name}
              </Text>
              {group.assets.map((asset) => (
                <Pressable
                  key={asset.id}
                  accessibilityRole="button"
                  android_ripple={ripple}
                  onPress={() => onChoose({ kind: "asset", asset })}
                  testID={`reconcile-add-asset-${asset.id}`}
                  style={styles.asset}
                >
                  <Text
                    variant="bodyLarge"
                    numberOfLines={1}
                    style={styles.grow}
                  >
                    {asset.name}
                  </Text>
                  <Text variant="labelLarge" style={muted}>
                    {t(`home.reconcile.accounts.${asset.direction}`)}
                  </Text>
                  <Icon source="plus" size={20} color={theme.colors.primary} />
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: TOUCH_TARGET + SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.card,
  },
  block: { gap: SPACING.sm, marginTop: SPACING.sm },
  // Further from the first group than the groups are from each other, whose
  // rows already end in half a touch target of air.
  blockHeader: { marginBottom: SPACING.md },
  asset: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: TOUCH_TARGET,
  },
  grow: { flex: 1 },
});
