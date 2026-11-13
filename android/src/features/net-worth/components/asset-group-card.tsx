import type { Asset, SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, IconButton, Menu, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { formatCompactCurrency, formatCurrency } from "@/core/ui/amount-format";
import { LedgerCard } from "@/core/ui/ledger";
import { useRipple } from "@/core/ui/ripple";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { StateChip } from "@/core/ui/state-chip";
import { SPACING } from "@/core/ui/theme";

import {
  assetAgeLabel,
  assetBadges,
  type NetWorthGroup,
  showsConversion,
  suggestionDetail,
  visibleSuggestion,
} from "../net-worth-sections";

export interface AssetActions {
  edit: (asset: Asset) => void;
  toggleArchive: (asset: Asset) => void;
  remove: (asset: Asset) => void;
  applySuggestion: (asset: Asset) => void;
  dismissSuggestion: (asset: Asset) => void;
}

interface AssetGroupCardProps {
  group: NetWorthGroup;
  baseCurrency: SupportedCurrency;
  /** Absent for « Découverts », which is not a Type and cannot be renamed. */
  onRenameType?: (group: NetWorthGroup) => void;
  /** Names a row's Type where the card is not one (« Découverts »). */
  categoryNames?: Record<string, string>;
  actions: AssetActions;
}

/** One Type: its name and total, then one row per asset. */
export function AssetGroupCard({
  group,
  baseCurrency,
  onRenameType,
  categoryNames,
  actions,
}: AssetGroupCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isMenuVisible, setMenuVisible] = useState(false);

  return (
    <View>
      <View style={styles.groupHeader}>
        <Text
          variant="titleSmall"
          accessibilityRole="header"
          numberOfLines={1}
          style={[styles.groupName, { color: theme.colors.onSurface }]}
        >
          {group.name}
        </Text>
        <Amount size="meta" tone="muted">
          {formatCompactCurrency(group.total, baseCurrency)}
        </Amount>
        {onRenameType !== undefined && (
          <Menu
            visible={isMenuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                onPress={() => setMenuVisible(true)}
                accessibilityLabel={t("netWorth.actionsFor", {
                  name: group.name,
                })}
              />
            }
          >
            <Menu.Item
              leadingIcon="pencil-outline"
              title={t("netWorth.renameType")}
              onPress={() => {
                setMenuVisible(false);
                onRenameType(group);
              }}
            />
          </Menu>
        )}
      </View>
      <AssetRows
        assets={group.assets}
        baseCurrency={baseCurrency}
        categoryNames={group.isType ? undefined : categoryNames}
        actions={actions}
      />
    </View>
  );
}

interface AssetRowsProps {
  assets: Asset[];
  baseCurrency: SupportedCurrency;
  categoryNames?: Record<string, string>;
  actions: AssetActions;
}

export function AssetRows({
  assets,
  baseCurrency,
  categoryNames,
  actions,
}: AssetRowsProps) {
  return (
    <LedgerCard dividerInset={0}>
      {assets.map((asset) => (
        <AssetRow
          key={asset.id}
          asset={asset}
          baseCurrency={baseCurrency}
          categoryName={categoryNames?.[asset.categoryId]}
          actions={actions}
        />
      ))}
    </LedgerCard>
  );
}

function AssetRow({
  asset,
  baseCurrency,
  categoryName,
  actions,
}: {
  asset: Asset;
  baseCurrency: SupportedCurrency;
  categoryName?: string;
  actions: AssetActions;
}) {
  const theme = useTheme();
  const financial = useFinancialColors();
  const ripple = useRipple();
  const { t } = useTranslation();
  const [isMenuVisible, setMenuVisible] = useState(false);
  const isArchived = asset.archivedAt !== null;

  const when = assetAgeLabel(asset.latestRecordedAt, new Date(), t);
  const updated =
    categoryName === undefined
      ? t("netWorth.updated", { when })
      : t("netWorth.updatedIn", { category: categoryName, when });
  // A followed account says where its balance comes from, in the same breath.
  const caption = asset.inPulpe
    ? t("netWorth.whenMatching", { line: updated })
    : updated;
  const value = formatCurrency(asset.latestValue, asset.currency);
  const converted = showsConversion(asset, baseCurrency)
    ? `≈ ${formatCurrency(asset.convertedValue ?? 0, baseCurrency)}`
    : null;
  const badges = assetBadges(asset);
  const suggestion = visibleSuggestion(asset);

  const body = (
    <View style={styles.content}>
      <View style={styles.line}>
        <Text
          variant="titleMedium"
          numberOfLines={2}
          style={[styles.name, { color: theme.colors.onSurface }]}
        >
          {asset.name}
        </Text>
        <View style={styles.values}>
          <Amount size="row" numberOfLines={1}>
            {value}
          </Amount>
          {converted !== null && (
            <Amount size="meta" tone="muted" numberOfLines={1}>
              {converted}
            </Amount>
          )}
        </View>
      </View>
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {caption}
      </Text>
      {badges.length > 0 && (
        <View style={styles.badges}>
          {badges.map((badge) => (
            <StateChip key={badge} tint={financial.overBudget}>
              {t(
                badge === "overdraft"
                  ? "netWorth.badgeOverdraft"
                  : "netWorth.badgeExcluded",
              )}
            </StateChip>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View>
      <View style={styles.row}>
        {isArchived ? (
          <View
            accessible
            accessibilityLabel={[asset.name, value, converted, caption]
              .filter(Boolean)
              .join(", ")}
            style={styles.main}
          >
            {body}
          </View>
        ) : (
          <Pressable
            onPress={() => actions.edit(asset)}
            android_ripple={ripple}
            accessibilityRole="button"
            accessibilityLabel={[asset.name, value, converted, caption]
              .filter(Boolean)
              .join(", ")}
            accessibilityHint={t("netWorth.editAccessibility", {
              name: asset.name,
            })}
            style={styles.main}
          >
            {body}
          </Pressable>
        )}
        <Menu
          visible={isMenuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
              onPress={() => setMenuVisible(true)}
              accessibilityLabel={t("netWorth.actionsFor", {
                name: asset.name,
              })}
            />
          }
        >
          {!isArchived && (
            <Menu.Item
              leadingIcon="pencil-outline"
              title={t("common.edit")}
              onPress={() => {
                setMenuVisible(false);
                actions.edit(asset);
              }}
            />
          )}
          <Menu.Item
            leadingIcon={
              isArchived ? "archive-arrow-up-outline" : "archive-outline"
            }
            title={t(isArchived ? "netWorth.unarchive" : "netWorth.archive")}
            onPress={() => {
              setMenuVisible(false);
              actions.toggleArchive(asset);
            }}
          />
          <Menu.Item
            leadingIcon="delete-outline"
            title={t("common.delete")}
            onPress={() => {
              setMenuVisible(false);
              actions.remove(asset);
            }}
          />
        </Menu>
      </View>
      {suggestion !== null && (
        <View style={styles.suggestion}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            {t("netWorth.suggestion.propose", {
              amount: formatCurrency(suggestion.proposedValue, asset.currency),
            })}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t(`netWorth.suggestion.${suggestionDetail(asset)}`, {
              amount: formatCurrency(
                Math.abs(suggestion.delta),
                asset.currency,
              ),
            })}
          </Text>
          <View style={styles.suggestionActions}>
            <Button
              mode="text"
              onPress={() => actions.dismissSuggestion(asset)}
            >
              {t("netWorth.suggestion.dismiss")}
            </Button>
            <Button
              mode="contained-tonal"
              onPress={() => actions.applySuggestion(asset)}
            >
              {t("netWorth.suggestion.apply")}
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingLeft: SPACING.xs,
  },
  groupName: { flex: 1 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  main: { flex: 1, paddingLeft: SPACING.md, paddingVertical: SPACING.md },
  content: { gap: SPACING.xs },
  line: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.md },
  name: { flex: 1 },
  values: { alignItems: "flex-end", flexShrink: 0, maxWidth: "45%" },
  badges: { flexDirection: "row", gap: SPACING.xs },
  suggestion: {
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  suggestionActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
  },
});
