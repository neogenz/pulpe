import type { TransactionKind } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { FieldError } from "@/core/ui/field-error";
import { FilterChip } from "@/core/ui/filter-chip";
import { SPACING } from "@/core/ui/theme";

import { type AccountChoices, accountConflicts } from "../account-link";

interface AccountFieldProps {
  choices: AccountChoices;
  /** The element id, `null` for « Aucun ». */
  value: string | null;
  onChange: (id: string | null) => void;
  /** The element the line already feeds, repays or is drawn from (CA25). */
  link?: string | null;
  linkKind?: TransactionKind;
}

/**
 * Which element a movement moves once checked: « Aucun », what I have, what I
 * owe. Chips rather than a menu, which a native modal would hide, as for the
 * Type of an element.
 */
export function AccountField({
  choices,
  value,
  onChange,
  link = null,
  linkKind = "saving",
}: AccountFieldProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = { color: theme.colors.onSurfaceVariant };
  const groups = [
    { key: "own", title: t("netWorth.have"), assets: choices.own },
    { key: "owe", title: t("netWorth.owe"), assets: choices.owe },
  ].filter((group) => group.assets.length > 0);

  return (
    <View
      style={styles.field}
      accessibilityLabel={t("netWorth.account.label")}
      testID="account-field"
    >
      <Text variant="labelLarge">{t("netWorth.account.label")}</Text>
      <View style={styles.chips}>
        <FilterChip
          testID="account-none"
          selected={value === null}
          onPress={() => onChange(null)}
        >
          {t("netWorth.account.none")}
        </FilterChip>
      </View>
      {groups.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text variant="labelMedium" style={muted}>
            {group.title}
          </Text>
          <View style={styles.chips}>
            {group.assets.map((asset) => (
              <FilterChip
                key={asset.id}
                testID={`account-${asset.id}`}
                selected={value === asset.id}
                onPress={() => onChange(asset.id)}
              >
                {asset.name}
              </FilterChip>
            ))}
          </View>
        </View>
      ))}
      {accountConflicts(value, link) && (
        <FieldError visible>
          {t("netWorth.account.sameAsLink", {
            link: t(`netWorth.account.link.${linkKind}`),
          })}
        </FieldError>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: SPACING.sm },
  group: { gap: SPACING.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
});
