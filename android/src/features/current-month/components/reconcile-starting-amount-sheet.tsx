import type { SupportedCurrency } from "pulpe-shared";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { AmountField, type AmountFieldHandle } from "@/core/ui/amount-field";
import { FormModal } from "@/core/ui/sheet";
import { SPACING, TOUCH_TARGET } from "@/core/ui/theme";

interface ReconcileStartingAmountSheetProps {
  isVisible: boolean;
  /** What the server holds as money from before Pulpe. */
  amount: number;
  currency: SupportedCurrency;
  onDismiss: () => void;
  /** One answer, one write: the typed amount, or 0 for « Remettre à 0 ». */
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
  const field = useRef<AmountFieldHandle>(null);
  const [typed, setTyped] = useState<number | null>(amount);
  // Each opening starts from the stored amount, as the field does.
  const [wasVisible, setWasVisible] = useState(isVisible);
  if (isVisible !== wasVisible) {
    setWasVisible(isVisible);
    if (isVisible) setTyped(amount);
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
            onPress={() => typed !== null && onSave(typed)}
            disabled={typed === null}
            contentStyle={styles.target}
          >
            {t("home.reconcile.compare.saveStartingAmount")}
          </Button>
          <Button
            mode="text"
            onPress={() => onSave(0)}
            contentStyle={styles.target}
          >
            {t("home.reconcile.compare.resetStartingAmount")}
          </Button>
        </View>
      }
    >
      <AmountField
        ref={field}
        label={t("home.reconcile.compare.startingAmountLabel")}
        amount={amount}
        currency={currency}
        onChange={setTyped}
      />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  actions: { gap: SPACING.xs },
  target: { minHeight: TOUCH_TARGET },
});
