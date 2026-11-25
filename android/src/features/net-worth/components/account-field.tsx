import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { TextInput } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { FieldError } from "@/core/ui/field-error";
import { useRipple } from "@/core/ui/ripple";
import { FormModal } from "@/core/ui/sheet";
import { SPACING } from "@/core/ui/theme";

import { type AccountChoices, accountConflicts } from "../account-link";
import { AccountChoiceList } from "./account-choice-list";

interface AccountFieldProps {
  choices: AccountChoices;
  /** The element id, `null` for « Aucun ». */
  value: string | null;
  onChange: (id: string | null) => void;
  /** The element the line already feeds, repays or is drawn from (CA25). */
  link?: string | null;
}

/**
 * Which element a movement moves once checked: one dropdown field that opens
 * the list in a sheet over the form, as iOS pushes its list. A Paper menu
 * would open behind the native modal the form lives in.
 */
export function AccountField({
  choices,
  value,
  onChange,
  link = null,
}: AccountFieldProps) {
  const { t } = useTranslation();
  const ripple = useRipple();
  const [isPicking, setPicking] = useState(false);
  const label = t("netWorth.account.label");
  const shown =
    [...choices.own, ...choices.owe].find((asset) => asset.id === value)
      ?.name ?? t("netWorth.account.none");
  const hasConflict = accountConflicts(value, link);

  return (
    <View style={styles.field}>
      <Pressable
        testID="account-field"
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${shown}`}
        onPress={() => setPicking(true)}
        // Over the field, which would otherwise paint over its own ripple.
        android_ripple={{ ...ripple, foreground: true }}
      >
        {/* Read-only: the whole field is the button that opens the list. Hidden
            from TalkBack too, or it stops again on the value and on an unlabelled arrow. */}
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <TextInput
            mode="outlined"
            label={label}
            value={shown}
            editable={false}
            error={hasConflict}
            right={<TextInput.Icon icon="menu-down" />}
          />
        </View>
      </Pressable>
      {hasConflict && (
        <FieldError visible>
          {t("netWorth.account.sameAsLink", { name: shown })}
        </FieldError>
      )}

      <FormModal
        isVisible={isPicking}
        onDismiss={() => setPicking(false)}
        title={label}
      >
        <AccountChoiceList
          choices={choices}
          value={value}
          onChange={(id) => {
            onChange(id);
            setPicking(false);
          }}
        />
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: SPACING.xs },
});
