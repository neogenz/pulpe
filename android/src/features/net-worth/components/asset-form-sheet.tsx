import {
  type Asset,
  CURRENCY_METADATA,
  type NetWorth,
  type SupportedCurrency,
} from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Switch, Text, TextInput, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { AmountField } from "@/core/ui/amount-field";
import { formatCurrency } from "@/core/ui/amount-format";
import { FieldError } from "@/core/ui/field-error";
import { formatInstantDay } from "@/core/ui/date-format";
import { hapticSuccess } from "@/core/ui/haptics";
import { SegmentedPicker } from "@/core/ui/segmented-picker";
import { FilterChip } from "@/core/ui/filter-chip";
import { FormModal } from "@/core/ui/sheet";
import { SPACING } from "@/core/ui/theme";

import {
  type AssetCategoryChoice,
  assetCreatePayload,
  assetDraftFrom,
  assetEdit,
  choiceForName,
  defaultChoice,
  emptyAssetDraft,
  isAssetDraftValid,
  STARTER_KEYS,
  typeOptions,
} from "../asset-form-draft";
import {
  useCreateAsset,
  useCreateAssetCategory,
  useRecordAssetSnapshots,
  useUpdateAsset,
} from "../net-worth-queries";

const NAME_MAX_LENGTH = 100;
const TYPE_MAX_LENGTH = 30;
const CURRENCIES = Object.keys(CURRENCY_METADATA) as SupportedCurrency[];

interface AssetFormSheetProps {
  /** Absent when adding; the asset being corrected otherwise. */
  asset?: Asset;
  netWorth: NetWorth | undefined;
  baseCurrency: SupportedCurrency;
  onDismiss: () => void;
  onToggleArchive: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
}

/**
 * Adds an asset to « Mon patrimoine », or edits one: its value, its name and
 * its Type, in one sheet. Direction and currency are frozen at creation.
 * Mounted only while open, so every opening starts from a fresh draft.
 */
export function AssetFormSheet({
  asset,
  netWorth,
  baseCurrency,
  onDismiss,
  onToggleArchive,
  onDelete,
}: AssetFormSheetProps) {
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const recordSnapshots = useRecordAssetSnapshots();
  const createCategory = useCreateAssetCategory();
  const categories = netWorth?.categories ?? [];
  const assets = netWorth?.assets ?? [];
  const isEditing = asset !== undefined;

  const optionsFor = (direction: Asset["direction"]) =>
    typeOptions(
      direction,
      categories,
      assets,
      STARTER_KEYS[direction].map((key) => t(`netWorth.starter.${key}`)),
    );

  const [draft, setDraft] = useState(() => {
    if (asset !== undefined) return assetDraftFrom(asset);
    const empty = emptyAssetDraft(baseCurrency);
    return { ...empty, category: defaultChoice(optionsFor(empty.direction)) };
  });
  const [typedType, setTypedType] = useState("");
  const [isTypingType, setTypingType] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [hasFailed, setFailed] = useState(false);
  const [hasTouchedName, setTouchedName] = useState(false);

  const options = optionsFor(draft.direction);
  const isSubmittable = isAssetDraftValid(draft) && !isSaving;

  function change(changes: Partial<typeof draft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  // The Types and the overdraft follow the direction: a debt is never filed
  // under « Comptes ».
  function changeDirection(direction: Asset["direction"]) {
    setTypingType(false);
    setTypedType("");
    change({
      direction,
      isOverdraft: false,
      category: defaultChoice(optionsFor(direction)),
    });
  }

  function pick(choice: AssetCategoryChoice) {
    change({ category: choice });
    setTypingType(false);
    setTypedType("");
  }

  function typeLabel(): string {
    if (isTypingType) return t("netWorth.form.otherType");
    const { category } = draft;
    if (category === null) return t("common.choose");
    if (category.kind === "starter") return category.name;
    return (
      categories.find((c) => c.id === category.id)?.name ?? t("common.choose")
    );
  }

  async function resolveCategoryId(
    choice: AssetCategoryChoice,
  ): Promise<string> {
    if (choice.kind === "existing") return choice.id;
    // A hidden Type of the same name must be reused, never duplicated.
    const match = choiceForName(choice.name, categories);
    if (match?.kind === "existing") return match.id;
    return (await createCategory.mutateAsync({ name: choice.name.trim() })).id;
  }

  async function submit() {
    if (!isSubmittable || draft.category === null) return;
    setSaving(true);
    setFailed(false);
    try {
      if (asset === undefined) {
        const categoryId = await resolveCategoryId(draft.category);
        await createAsset.mutateAsync(assetCreatePayload(draft, categoryId));
      } else {
        const edit = assetEdit(draft, asset);
        const changes = {
          ...(edit.name !== undefined && { name: edit.name }),
          ...(edit.category !== undefined && {
            categoryId: await resolveCategoryId(edit.category),
          }),
        };
        if (Object.keys(changes).length > 0) {
          await updateAsset.mutateAsync({ assetId: asset.id, changes });
        }
        if (edit.value !== undefined) {
          await recordSnapshots.mutateAsync({
            items: [{ assetId: asset.id, value: edit.value }],
          });
        }
      }
      hapticSuccess();
      onDismiss();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  const nameError =
    hasTouchedName && draft.name.trim() === ""
      ? t("netWorth.form.nameError")
      : null;

  return (
    <FormModal
      isVisible
      onDismiss={onDismiss}
      isBusy={isSaving}
      title={
        asset === undefined
          ? t("netWorth.form.addTitle")
          : t("netWorth.form.editTitle", { name: asset.name })
      }
      footer={
        <>
          {hasFailed && (
            <FieldError visible>{t("netWorth.saveError")}</FieldError>
          )}
          <Button
            mode="contained"
            onPress={() => void submit()}
            disabled={!isSubmittable}
            loading={isSaving}
          >
            {t(isEditing ? "netWorth.form.save" : "netWorth.form.create")}
          </Button>
          {asset !== undefined && (
            <View style={styles.footerActions}>
              <Button
                mode="text"
                icon={
                  asset.archivedAt === null
                    ? "archive-outline"
                    : "archive-arrow-up-outline"
                }
                disabled={isSaving}
                onPress={() => onToggleArchive(asset)}
              >
                {t(
                  asset.archivedAt === null
                    ? "netWorth.archive"
                    : "netWorth.unarchive",
                )}
              </Button>
              <Button
                mode="text"
                icon="delete-outline"
                textColor={theme.colors.error}
                disabled={isSaving}
                onPress={() => onDelete(asset)}
              >
                {t("common.delete")}
              </Button>
            </View>
          )}
        </>
      }
    >
      <AmountField
        isProminent
        autoFocus={!isEditing}
        label={t("netWorth.form.value")}
        amount={draft.amount}
        currency={draft.currency}
        onChange={(amount) => change({ amount })}
      />
      {asset !== undefined && (
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("netWorth.form.lastValue", {
            amount: formatCurrency(Math.abs(asset.latestValue), asset.currency),
            date: formatInstantDay(asset.latestRecordedAt, locale),
          })}
        </Text>
      )}

      {draft.direction === "own" && (
        <View style={styles.toggleRow}>
          <Text variant="bodyLarge" style={styles.toggleLabel}>
            {t("netWorth.form.overdraft")}
          </Text>
          <Switch
            value={draft.isOverdraft}
            onValueChange={(isOverdraft) => change({ isOverdraft })}
            accessibilityLabel={t("netWorth.form.overdraft")}
          />
        </View>
      )}

      <TextInput
        mode="outlined"
        label={t("netWorth.form.name")}
        placeholder={t("netWorth.form.namePlaceholder")}
        value={draft.name}
        onChangeText={(name) => {
          setTouchedName(true);
          change({ name });
        }}
        maxLength={NAME_MAX_LENGTH}
        error={nameError !== null}
      />
      {nameError !== null && <FieldError visible>{nameError}</FieldError>}

      <SegmentedPicker
        accessibilityLabel={t("netWorth.form.side")}
        value={draft.direction}
        onValueChange={changeDirection}
        buttons={(["own", "owe"] as const).map((direction) => ({
          value: direction,
          label: t(direction === "own" ? "netWorth.have" : "netWorth.owe"),
          disabled: isEditing && direction !== draft.direction,
        }))}
      />
      {isEditing ? (
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("netWorth.form.frozen")}
        </Text>
      ) : (
        <SegmentedPicker
          accessibilityLabel={t("netWorth.form.currency")}
          value={draft.currency}
          onValueChange={(currency) => change({ currency })}
          buttons={CURRENCIES.map((currency) => ({
            value: currency,
            label: currency,
          }))}
        />
      )}

      {/* Chips rather than a menu: a Paper menu mounts in the app's portal
          host, behind the native modal this sheet lives in. */}
      <View style={styles.typeField}>
        <Text variant="labelLarge">{t("netWorth.form.type")}</Text>
        <View style={styles.typeChips}>
          {options.used.map((category) => (
            <FilterChip
              key={category.id}
              selected={!isTypingType && typeLabel() === category.name}
              onPress={() => pick({ kind: "existing", id: category.id })}
            >
              {category.name}
            </FilterChip>
          ))}
          {options.suggestions.map((name) => (
            <FilterChip
              key={name}
              selected={!isTypingType && typeLabel() === name}
              onPress={() => pick({ kind: "starter", name })}
            >
              {name}
            </FilterChip>
          ))}
          <FilterChip
            selected={isTypingType}
            onPress={() => {
              setTypingType(true);
              change({ category: choiceForName(typedType, categories) });
            }}
          >
            {t("netWorth.form.otherType")}
          </FilterChip>
        </View>
      </View>
      {isTypingType && (
        <TextInput
          mode="outlined"
          autoFocus
          label={t("netWorth.typeName")}
          value={typedType}
          maxLength={TYPE_MAX_LENGTH}
          onChangeText={(name) => {
            setTypedType(name);
            change({ category: choiceForName(name, categories) });
          }}
        />
      )}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  toggleLabel: { flex: 1 },
  typeField: { gap: SPACING.sm },
  typeChips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  footerActions: { flexDirection: "row", justifyContent: "space-between" },
});
