import {
  CURRENCY_METADATA,
  parseAccountAmount,
  type SupportedCurrency,
} from "pulpe-shared";
import { useRef, useState } from "react";
import {
  type TextInput as NativeTextInput,
  StyleSheet,
  View,
} from "react-native";
import { Button, TextInput } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { amountFieldAccessibilityLabel } from "@/core/ui/amount-field";
import { FieldError } from "@/core/ui/field-error";
import { FormModal } from "@/core/ui/sheet";
import { SPACING, TABULAR_DIGITS, TOUCH_TARGET } from "@/core/ui/theme";

interface ReconcileStartingAmountSheetProps {
  isVisible: boolean;
  /** What the server holds as money from before Pulpe. */
  amount: number;
  currency: SupportedCurrency;
  onDismiss: () => void;
  /** One answer, one write: the typed amount, or 0 for « Remettre à 0 ». The same amount only closes. */
  onSave: (amount: number) => void;
}

/** « Argent d'avant Pulpe », corrected or reset; the comparison's figure follows. */
export function ReconcileStartingAmountSheet({
  isVisible,
  amount,
  currency,
  onDismiss,
  onSave,
}: ReconcileStartingAmountSheetProps) {
  const { t } = useTranslation();
  const field = useRef<NativeTextInput>(null);
  // Signed, as on step 1: money from before Pulpe can be an overdraft (« -500 »).
  const [text, setText] = useState(String(amount));
  // Each opening starts from the stored amount.
  const [wasVisible, setWasVisible] = useState(isVisible);
  if (isVisible !== wasVisible) {
    setWasVisible(isVisible);
    if (isVisible) setText(String(amount));
  }
  const parsed = parseAccountAmount(text);
  const typed = parsed.status === "valid" ? parsed.cents / 100 : null;
  const label = t("home.reconcile.compare.startingAmountLabel");

  function save(value: number) {
    if (value === amount) onDismiss();
    else onSave(value);
  }

  return (
    <FormModal
      isVisible={isVisible}
      onDismiss={onDismiss}
      title={t("home.reconcile.compare.startingAmountTitle")}
      // Opened to type: the keyboard comes with it, as on iOS and the web.
      onShow={() => field.current?.focus()}
      footer={
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={() => typed !== null && save(typed)}
            disabled={typed === null}
            contentStyle={styles.target}
          >
            {t("home.reconcile.compare.saveStartingAmount")}
          </Button>
          <Button
            mode="text"
            onPress={() => save(0)}
            contentStyle={styles.target}
          >
            {t("home.reconcile.compare.resetStartingAmount")}
          </Button>
        </View>
      }
    >
      <TextInput
        ref={field}
        mode="outlined"
        label={label}
        value={text}
        onChangeText={setText}
        // Android's numeric pad carries the minus; the decimal pad does not.
        keyboardType="numeric"
        error={parsed.status === "invalid"}
        contentStyle={TABULAR_DIGITS}
        right={<TextInput.Affix text={CURRENCY_METADATA[currency].symbol} />}
        accessibilityLabel={amountFieldAccessibilityLabel(t, label, currency)}
        testID="reconcile-starting-amount-field"
      />
      {parsed.status === "invalid" && (
        <FieldError visible>
          {t("home.reconcile.accounts.invalidAmount")}
        </FieldError>
      )}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  actions: { gap: SPACING.xs },
  target: { minHeight: TOUCH_TARGET },
});
