import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { type Asset, CURRENCY_METADATA } from "pulpe-shared";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";

import { ApiError } from "@/core/api/api-error";
import { useTranslation } from "@/core/i18n/locale-store";
import { formatAmount } from "@/core/ui/amount-format";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatMonthName } from "@/core/ui/date-format";
import {
  HeroAppBar,
  HeroAppBarAction,
  HeroFigure,
  HeroZone,
} from "@/core/ui/hero";
import { InlineQueryError } from "@/core/ui/inline-query-error";
import { LedgerSegment } from "@/core/ui/ledger";
import { Notice } from "@/core/ui/notice";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
import { useHeroColors } from "@/core/ui/scheme-colors";
import { SectionHeader } from "@/core/ui/section-header";
import { SPACING } from "@/core/ui/theme";
import { invalidateUserSettings } from "@/core/user-settings/user-settings-queries";
import { AssetFormSheet } from "@/features/net-worth/components/asset-form-sheet";
import { AssetHistoryRow } from "@/features/net-worth/components/asset-history-row";
import { DeleteAssetDialog } from "@/features/net-worth/components/delete-asset-dialog";
import {
  refetchStaleNetWorth,
  useAssetHistory,
  useDeleteAsset,
  useNetWorth,
  useUpdateAsset,
} from "@/features/net-worth/net-worth-queries";
import {
  formatEntryDate,
  signedAmount,
} from "@/features/net-worth/net-worth-sections";

const HTTP_NOT_FOUND = 404;

/**
 * An element of « Mon patrimoine »: its value today, my last entry, and every
 * entry and checked movement since it was created, newest first. Nothing is
 * computed here: the server sends the history with the value it explains.
 */
export default function AssetDetailScreen() {
  useAmountMasking();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const hero = useHeroColors();
  const { locale, t } = useTranslation();
  const history = useAssetHistory(id);
  const netWorth = useNetWorth();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();
  const pull = usePullToRefresh(() => history.refetch());
  const [isEditing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const [hasWriteFailed, setWriteFailed] = useState(false);
  // A pointing in a budget only marks this read stale (CA8): coming back here
  // is when it is looked at again.
  useFocusEffect(
    useCallback(() => {
      void refetchStaleNetWorth();
    }, []),
  );

  const asset = history.data?.pages[0]?.asset;
  const entries = history.data?.pages.flatMap((page) => page.entries) ?? [];
  // Every page carries it: the latest one is the freshest.
  const projection = history.data?.pages.at(-1)?.monthEndProjection ?? null;
  // Archiving or deleting here refetches this history before going back: that
  // 404 is my own write, not the element gone elsewhere.
  const isLeaving =
    updateAsset.isPending ||
    updateAsset.isSuccess ||
    deleteAsset.isPending ||
    deleteAsset.isSuccess;
  // Archived or deleted elsewhere: the server no longer shows it (CA15).
  const isNotFound =
    !isLeaving &&
    history.error instanceof ApiError &&
    history.error.status === HTTP_NOT_FOUND;

  // Archiving or deleting the default account clears the setting on the
  // server; the element is gone from here either way.
  const afterRemoval = {
    onError: () => setWriteFailed(true),
    onSuccess: () => {
      void invalidateUserSettings();
      router.back();
    },
  };

  const bar = (
    <HeroAppBar
      title={isNotFound ? "" : (asset?.name ?? "")}
      onBack={() => router.back()}
      backLabel={t("netWorth.detail.back")}
    >
      {asset !== undefined && !isNotFound && (
        <HeroAppBarAction
          icon="pencil-outline"
          onPress={() => setEditing(true)}
          accessibilityLabel={t("common.edit")}
        />
      )}
    </HeroAppBar>
  );

  let body;
  if (isNotFound) {
    body = (
      <PlaceholderScreen
        icon="archive-outline"
        tone="neutral"
        title={t("netWorth.detail.notFound")}
        action={{
          label: t("netWorth.detail.back"),
          onPress: () => router.back(),
        }}
      />
    );
  } else if (asset === undefined) {
    body = history.isError ? (
      <PlaceholderScreen
        icon="cloud-off-outline"
        tone="neutral"
        title={t("netWorth.detail.loadError")}
        hint={t("common.loadErrorHint")}
        action={{
          label: t("common.retry"),
          onPress: () => void history.refetch(),
        }}
      />
    ) : (
      <View style={styles.centered}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </View>
    );
  } else {
    const typeName =
      netWorth.data?.categories.find(
        (category) => category.id === asset.categoryId,
      )?.name ?? "";
    const entryDate = formatEntryDate(asset.latestRecordedAt, locale);
    // Newest first: an entry on top means nothing was checked since (CA10).
    const isUntouchedSinceEntry = entries[0]?.type === "snapshot";
    const monthEnd = projection && {
      month: formatMonthName(projection.month, projection.year, locale),
      amount: signedAmount(projection.value, asset.currency, false),
    };

    const header = (
      <>
        <HeroZone style={styles.hero}>
          <HeroFigure
            eyebrow={typeName}
            amount={
              asset.latestValue < 0
                ? `−${formatAmount(-asset.latestValue, asset.currency)}`
                : formatAmount(asset.latestValue, asset.currency)
            }
            currency={CURRENCY_METADATA[asset.currency].symbol}
          />
          {monthEnd && (
            <Text
              variant="bodyMedium"
              style={{ color: hero.support }}
              accessibilityLabel={t(
                "netWorth.detail.monthEndAccessibility",
                monthEnd,
              )}
            >
              {t("netWorth.detail.monthEnd", monthEnd)}
            </Text>
          )}
          <Text variant="bodyMedium" style={{ color: hero.support }}>
            {t("netWorth.form.lastValue", {
              amount: signedAmount(asset.recordedValue, asset.currency, false),
              date: entryDate,
            })}
          </Text>
        </HeroZone>
        <View style={styles.section}>
          <SectionHeader title={t("netWorth.detail.history")} />
          {isUntouchedSinceEntry && (
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("netWorth.detail.nothingSince", { date: entryDate })}
            </Text>
          )}
        </View>
      </>
    );

    let footer = null;
    if (history.isFetchingNextPage) {
      footer = (
        <ActivityIndicator
          style={styles.footer}
          accessibilityLabel={t("common.loading")}
        />
      );
    } else if (history.isFetchNextPageError) {
      footer = (
        <View style={styles.footer}>
          <InlineQueryError
            message={t("netWorth.detail.loadMoreError")}
            onRetry={() => void history.fetchNextPage()}
          />
        </View>
      );
    }

    body = (
      <FlatList
        testID="asset-history"
        data={entries}
        // A prévision shows once per period it moved in, under the same id.
        keyExtractor={(entry) => `${entry.type}-${entry.id}-${entry.at}`}
        renderItem={({ item, index }) => (
          <LedgerSegment
            isFirst={index === 0}
            isLast={index === entries.length - 1}
          >
            <AssetHistoryRow entry={item} currency={asset.currency} />
          </LedgerSegment>
        )}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        onEndReached={() => {
          // A failed page waits for its retry instead of looping on the end.
          if (
            history.hasNextPage &&
            !history.isFetchingNextPage &&
            !history.isFetchNextPageError
          ) {
            void history.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl {...pull} />}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {bar}
      {body}

      {isEditing && asset !== undefined && (
        <AssetFormSheet
          asset={asset}
          netWorth={netWorth.data}
          baseCurrency={netWorth.data?.totals.baseCurrency ?? "CHF"}
          onDismiss={() => setEditing(false)}
          onToggleArchive={(edited) => {
            setEditing(false);
            updateAsset.mutate(
              { assetId: edited.id, changes: { archived: true } },
              afterRemoval,
            );
          }}
          onDelete={(edited) => {
            setEditing(false);
            setPendingDelete(edited);
          }}
        />
      )}
      <DeleteAssetDialog
        asset={pendingDelete}
        onDismiss={() => setPendingDelete(null)}
        onConfirm={(removed) => deleteAsset.mutate(removed.id, afterRemoval)}
      />
      <Notice
        visible={hasWriteFailed}
        onDismiss={() => setWriteFailed(false)}
        duration={4000}
      >
        {t("netWorth.saveError")}
      </Notice>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { gap: SPACING.sm },
  section: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  content: { paddingBottom: SPACING.xxl },
  footer: { padding: SPACING.md },
});
