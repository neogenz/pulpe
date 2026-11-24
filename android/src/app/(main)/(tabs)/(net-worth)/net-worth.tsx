import type { Asset } from "pulpe-shared";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  useTheme,
} from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { ContentZone } from "@/core/ui/hero";
import { Notice } from "@/core/ui/notice";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { SectionHeader } from "@/core/ui/section-header";
import { TabHeader } from "@/core/ui/tab-header";
import { SPACING } from "@/core/ui/theme";
import {
  invalidateUserSettings,
  useUserSettings,
} from "@/core/user-settings/user-settings-queries";
import { useUpdateUserSettings } from "@/features/account/account-queries";
import { defaultAfterToggle } from "@/features/net-worth/account-link";
import { AssetFormSheet } from "@/features/net-worth/components/asset-form-sheet";
import { DeleteAssetDialog } from "@/features/net-worth/components/delete-asset-dialog";
import {
  type IntroOutcome,
  NetWorthIntroSheet,
} from "@/features/net-worth/components/net-worth-intro-sheet";
import {
  hasSeenNetWorthIntro,
  markNetWorthIntroSeen,
} from "@/features/net-worth/net-worth-intro-gate";
import type { IntroSource } from "@/features/net-worth/net-worth-intro";
import {
  type AssetActions,
  AssetGroupCard,
  AssetRows,
} from "@/features/net-worth/components/asset-group-card";
import { NetWorthAllocation } from "@/features/net-worth/components/net-worth-allocation";
import { NetWorthHero } from "@/features/net-worth/components/net-worth-hero";
import { RenameTypeSheet } from "@/features/net-worth/components/rename-type-sheet";
import {
  refetchStaleNetWorth,
  useDeleteAsset,
  useNetWorth,
  useUpdateAsset,
} from "@/features/net-worth/net-worth-queries";
import {
  allocationShares,
  buildNetWorthSections,
  type NetWorthGroup,
} from "@/features/net-worth/net-worth-sections";

type FormTarget = { kind: "create" } | { kind: "edit"; asset: Asset };

/** « Mon patrimoine »: net worth, then what I have and what I owe, each by Type. */
export default function NetWorthScreen() {
  // Repaints when amounts are hidden or shown; the masking itself lives in the
  // formatters.
  useAmountMasking();
  const theme = useTheme();
  const { t } = useTranslation();
  const netWorth = useNetWorth();
  const pull = usePullToRefresh(() => netWorth.refetch());
  // A budget write only marks this read stale; coming back to the tab is when
  // the values it moved are looked at, so it asks once here.
  useFocusEffect(
    useCallback(() => {
      void refetchStaleNetWorth();
    }, []),
  );
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();
  const settings = useUserSettings();
  const updateSettings = useUpdateUserSettings();
  const defaultAccountId = settings.data?.defaultAccountId ?? null;
  const [form, setForm] = useState<FormTarget | null>(null);
  const [renaming, setRenaming] = useState<NetWorthGroup | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const [showsArchived, setShowsArchived] = useState(false);
  const [hasWriteFailed, setWriteFailed] = useState(false);

  const sections = useMemo(
    () =>
      netWorth.data === undefined
        ? null
        : buildNetWorthSections(netWorth.data, t("netWorth.overdrafts")),
    [netWorth.data, t],
  );
  const categoryNames = useMemo(
    () =>
      Object.fromEntries(
        (netWorth.data?.categories ?? []).map((c) => [c.id, c.name]),
      ),
    [netWorth.data],
  );

  // A failed write is told by a toast; the mutation has already refetched.
  const onError = () => setWriteFailed(true);
  // Archiving or deleting the default account clears the setting on the
  // server (CA35): read it again.
  const afterRemoval = {
    onError,
    onSuccess: () => void invalidateUserSettings(),
  };
  const actions: AssetActions = {
    open: (asset) => router.push(`/asset/${asset.id}`),
    edit: (asset) => setForm({ kind: "edit", asset }),
    toggleArchive: (asset) =>
      updateAsset.mutate(
        { assetId: asset.id, changes: { archived: asset.archivedAt === null } },
        afterRemoval,
      ),
    remove: setPendingDelete,
    toggleDefault: (asset) =>
      updateSettings.mutate(
        { defaultAccountId: defaultAfterToggle(asset, defaultAccountId) },
        { onError },
      ),
  };

  // The explainer opens by itself the first time the tab shows its content.
  // Tabs stay mounted: a load that lands after the user left must not cover another tab.
  const isFocused = useIsFocused();
  const [requestedIntro, setRequestedIntro] = useState<IntroSource | null>(
    null,
  );
  const [hasSeenIntro, setHasSeenIntro] = useState(hasSeenNetWorthIntro);
  const introSource =
    requestedIntro ??
    (isFocused && sections !== null && !hasSeenIntro ? "auto" : null);
  // FormModal has no after-close callback: the intro unmounts and the creation
  // sheet mounts in the same render, never both at once.
  const finishIntro = (outcome: IntroOutcome) => {
    markNetWorthIntroSeen();
    setHasSeenIntro(true);
    setRequestedIntro(null);
    if (outcome.kind === "completed" && outcome.action === "add") {
      setForm({ kind: "create" });
    }
  };

  const trailing = (
    <>
      <Appbar.Action
        icon="help-circle-outline"
        onPress={() => setRequestedIntro("help")}
        accessibilityLabel={t("netWorth.intro.help")}
      />
      {sections !== null && !sections.isEmpty && (
        <Appbar.Action
          icon="plus"
          onPress={() => setForm({ kind: "create" })}
          accessibilityLabel={t("netWorth.addAccessibility")}
        />
      )}
    </>
  );

  let body;
  if (netWorth.isPending) {
    body = (
      <View style={styles.centered}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </View>
    );
  } else if (sections === null) {
    body = (
      <PlaceholderScreen
        icon="cloud-off-outline"
        tone="neutral"
        title={t("netWorth.loadErrorTitle")}
        hint={t("common.loadErrorHint")}
        action={{
          label: t("common.retry"),
          onPress: () => void netWorth.refetch(),
        }}
      />
    );
  } else if (sections.isEmpty) {
    body = (
      <PlaceholderScreen
        icon="bank-outline"
        title={t("netWorth.emptyTitle")}
        hint={t("netWorth.emptyHint")}
        action={{
          label: t("netWorth.addAsset"),
          onPress: () => setForm({ kind: "create" }),
        }}
      />
    );
  } else {
    const side = (title: string, groups: NetWorthGroup[]) =>
      groups.length > 0 && (
        <View style={styles.side}>
          <SectionHeader title={title} />
          {groups.map((group) => (
            <AssetGroupCard
              key={group.id}
              group={group}
              baseCurrency={sections.baseCurrency}
              onRenameType={group.isType ? setRenaming : undefined}
              categoryNames={categoryNames}
              actions={actions}
              defaultAccountId={defaultAccountId}
            />
          ))}
        </View>
      );

    body = (
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl {...pull} />}
      >
        <NetWorthHero sections={sections} />
        <ContentZone style={styles.content}>
          <NetWorthAllocation
            shares={allocationShares(sections.categories, sections.gross)}
            baseCurrency={sections.baseCurrency}
          />
          {side(t("netWorth.have"), sections.categories)}
          {side(t("netWorth.owe"), sections.debtGroups)}
          {sections.archived.length > 0 && (
            <View style={styles.side}>
              <Button
                mode="text"
                icon={showsArchived ? "chevron-up" : "chevron-down"}
                onPress={() => setShowsArchived((shown) => !shown)}
                style={styles.archivedToggle}
              >
                {showsArchived
                  ? t("netWorth.hideArchived")
                  : t("netWorth.showArchived", {
                      count: sections.archived.length,
                    })}
              </Button>
              {showsArchived && (
                <AssetRows
                  assets={sections.archived}
                  baseCurrency={sections.baseCurrency}
                  actions={actions}
                  defaultAccountId={defaultAccountId}
                />
              )}
            </View>
          )}
        </ContentZone>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <TabHeader
        title={t("netWorth.title")}
        trailing={sections !== null ? trailing : undefined}
      />
      {body}

      {introSource !== null && sections !== null && (
        <NetWorthIntroSheet
          source={introSource}
          isEmpty={sections.isEmpty}
          currency={sections.baseCurrency}
          onFinish={finishIntro}
        />
      )}
      {introSource === null && form !== null && (
        <AssetFormSheet
          asset={form.kind === "edit" ? form.asset : undefined}
          netWorth={netWorth.data}
          baseCurrency={sections?.baseCurrency ?? "CHF"}
          onDismiss={() => setForm(null)}
          onToggleArchive={(asset) => {
            setForm(null);
            actions.toggleArchive(asset);
          }}
          onDelete={(asset) => {
            setForm(null);
            setPendingDelete(asset);
          }}
        />
      )}
      {renaming !== null && (
        <RenameTypeSheet type={renaming} onDismiss={() => setRenaming(null)} />
      )}

      <DeleteAssetDialog
        asset={pendingDelete}
        onDismiss={() => setPendingDelete(null)}
        onConfirm={(asset) => deleteAsset.mutate(asset.id, afterRemoval)}
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
  scroll: { flexGrow: 1 },
  content: { gap: SPACING.lg, paddingBottom: SPACING.xl },
  side: { gap: SPACING.sm },
  archivedToggle: { alignSelf: "flex-start" },
});
