import { StyleSheet, View } from "react-native";
import { RadioButton } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Card } from "@/core/ui/card";
import { SPACING } from "@/core/ui/theme";
import { SettingsSection } from "@/features/account/components/settings-section";

import type { AccountChoices } from "../account-link";

const NONE = "none";

interface AccountChoiceListProps {
  choices: AccountChoices;
  /** The element id, `null` for « Aucun ». */
  value: string | null;
  onChange: (id: string | null) => void;
}

/**
 * « Aucun », then what I have, then what I owe: the one list behind the
 * « Compte » of a form and the « Compte par défaut » setting (CA1, CA28).
 */
export function AccountChoiceList({
  choices,
  value,
  onChange,
}: AccountChoiceListProps) {
  const { t } = useTranslation();
  const groups = [
    { key: "own", title: t("netWorth.have"), assets: choices.own },
    { key: "owe", title: t("netWorth.owe"), assets: choices.owe },
  ].filter((group) => group.assets.length > 0);

  return (
    <RadioButton.Group
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
    >
      <View style={styles.groups}>
        <Card mode="contained">
          <RadioButton.Item
            testID="account-none"
            value={NONE}
            label={t("netWorth.account.none")}
            accessibilityLabel={t("netWorth.account.none")}
          />
        </Card>
        {groups.map((group) => (
          <SettingsSection key={group.key} title={group.title}>
            {group.assets.map((asset) => (
              <RadioButton.Item
                key={asset.id}
                testID={`account-${asset.id}`}
                value={asset.id}
                label={asset.name}
                accessibilityLabel={asset.name}
              />
            ))}
          </SettingsSection>
        ))}
      </View>
    </RadioButton.Group>
  );
}

const styles = StyleSheet.create({
  groups: { gap: SPACING.lg },
});
