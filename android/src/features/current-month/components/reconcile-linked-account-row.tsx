import {
  type Asset,
  CURRENCY_METADATA,
  type SupportedCurrency,
} from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import {
  Button,
  IconButton,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatCurrency } from "@/core/ui/amount-format";
import { FieldError } from "@/core/ui/field-error";
import { FilterChip } from "@/core/ui/filter-chip";
import { SPACING } from "@/core/ui/theme";
import { assetAgeLabel } from "@/features/net-worth/net-worth-sections";

import {
  type AccountRow,
  missingForNewAccount,
} from "../reconcile-account-links";

// What the API takes for an asset name.
const NAME_MAX_LENGTH = 100;

interface ReconcileLinkedAccountRowProps {
  row: AccountRow;
  number: number;
  /** The account behind the row, `null` for a typed line. */
  asset: Asset | null;
  /** My accounts no other row holds, this row's own included. */
  choices: Asset[];
  currency: SupportedCurrency;
  isNegative: boolean;
  isUnreadable: boolean;
  canRemove: boolean;
  onChange: (changes: Partial<Omit<AccountRow, "id">>) => void;
  onSelect: (asset: Asset | null) => void;
  onToggleNegative: () => void;
  onLeaveAmount: () => void;
  onRemove: () => void;
}

/**
 * One account of the reconciliation with « Mon patrimoine » on: picked among
 * mine or typed as another one, which a switch can add to Mon patrimoine.
 * `ReconcileAccountRow` on iOS; chips stand for its menu, which a native
 * modal cannot host.
 */
export function ReconcileLinkedAccountRow({
  row,
  number,
  asset,
  choices,
  currency,
  isNegative,
  isUnreadable,
  canRemove,
  onChange,
  onSelect,
  onToggleNegative,
  onLeaveAmount,
  onRemove,
}: ReconcileLinkedAccountRowProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = { color: theme.colors.onSurfaceVariant };
  const missing = missingForNewAccount(row);
  const isAdded = row.account.kind === "other" && row.account.addToNetWorth;
  // Taking a followed account off the list stops following it: the action says so.
  const stopsFollowing = asset?.inPulpe === true;
  const name = row.label.trim();

  return (
    <View style={styles.account}>
      {choices.length > 0 && (
        <View
          style={styles.chips}
          accessibilityLabel={t("home.reconcile.accounts.accountNumbered", {
            index: number,
          })}
        >
          {choices.map((choice) => (
            <FilterChip
              key={choice.id}
              selected={choice.id === asset?.id}
              onPress={() => onSelect(choice)}
            >
              {choice.name}
            </FilterChip>
          ))}
          <FilterChip selected={asset === null} onPress={() => onSelect(null)}>
            {t("home.reconcile.accounts.otherAccount")}
          </FilterChip>
        </View>
      )}
      {asset === null ? (
        <TextInput
          mode="outlined"
          label={t("home.reconcile.accounts.newAccountName")}
          value={row.label}
          onChangeText={(label) => onChange({ label })}
          maxLength={NAME_MAX_LENGTH}
        />
      ) : (
        choices.length === 0 && <Text variant="titleMedium">{asset.name}</Text>
      )}
      <View style={styles.amountRow}>
        <TextInput
          mode="outlined"
          style={styles.amountInput}
          label={t("home.reconcile.accounts.amount")}
          value={row.amountText}
          onChangeText={(amountText) => onChange({ amountText })}
          onBlur={onLeaveAmount}
          keyboardType="numeric"
          error={isUnreadable}
          right={<TextInput.Affix text={CURRENCY_METADATA[currency].symbol} />}
        />
        <IconButton
          icon="plus-minus-variant"
          selected={isNegative}
          onPress={onToggleNegative}
          accessibilityLabel={t("home.reconcile.accounts.negative")}
          accessibilityState={{ selected: isNegative }}
        />
        {canRemove && !stopsFollowing && (
          <IconButton
            icon="trash-can-outline"
            onPress={onRemove}
            accessibilityLabel={
              name === ""
                ? t("home.reconcile.accounts.removeNumbered", { index: number })
                : t("home.reconcile.accounts.removeNamed", { name })
            }
          />
        )}
      </View>
      {isUnreadable && (
        <FieldError visible>
          {t("home.reconcile.accounts.invalidAmount")}
        </FieldError>
      )}
      {asset !== null && (
        <Text variant="bodySmall" style={muted}>
          {t("home.reconcile.accounts.lastBalance", {
            amount: formatCurrency(asset.latestValue, asset.currency),
            when: assetAgeLabel(asset.latestRecordedAt, new Date(), t),
          })}
        </Text>
      )}
      {/* Asked in the neutral ink: nothing was done wrong yet. */}
      {missing !== null && (
        <Text variant="bodySmall" style={muted}>
          {t(
            missing === "name"
              ? "home.reconcile.accounts.nameMissing"
              : "home.reconcile.accounts.balanceMissing",
          )}
        </Text>
      )}
      {asset === null && (
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabel}>
            <Text variant="bodyLarge">
              {t("home.reconcile.accounts.addToNetWorth")}
            </Text>
            <Text variant="bodySmall" style={muted}>
              {t("home.reconcile.accounts.addToNetWorthHint")}
            </Text>
          </View>
          <Switch
            value={isAdded}
            onValueChange={(addToNetWorth) =>
              onChange({ account: { kind: "other", addToNetWorth } })
            }
            accessibilityLabel={t("home.reconcile.accounts.addToNetWorth")}
          />
        </View>
      )}
      {canRemove && stopsFollowing && (
        <Button mode="text" onPress={onRemove} style={styles.stopFollowing}>
          {t("home.reconcile.accounts.stopFollowing")}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  account: { gap: SPACING.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  amountRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xxs },
  amountInput: { flex: 1 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  toggleLabel: { flex: 1, gap: SPACING.xxs },
  stopFollowing: { alignSelf: "flex-start" },
});
