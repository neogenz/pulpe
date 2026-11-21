import { CURRENCY_METADATA, type SupportedCurrency } from "pulpe-shared";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { IconButton, Text, TextInput, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { FieldError } from "@/core/ui/field-error";
import { useFinancialColors, useV2Colors } from "@/core/ui/scheme-colors";
import { SegmentedPicker } from "@/core/ui/segmented-picker";
import { useRevealInSheet } from "@/core/ui/sheet";
import { RADIUS, SPACING, TABULAR_DIGITS, TOUCH_TARGET } from "@/core/ui/theme";

import {
  ACCOUNT_NAME_MAX_LENGTH,
  type AccountRow,
  type RowSide,
} from "../reconcile-account-links";

// A pasted « -800 » already says it: no second sign in front.
const LEADING_MINUS = /^\s*[-−]/;

interface ReconcileAccountRowProps {
  row: AccountRow;
  /** 1-based, names a row that has no name yet. */
  number: number;
  currency: SupportedCurrency;
  isUnreadable: boolean;
  /** Takes the keyboard when the row appears: the field the person types in next. */
  autoFocus: boolean;
  onFocus?: () => void;
  onChange: (changes: Partial<Omit<AccountRow, "id" | "account">>) => void;
  onLeaveAmount: () => void;
  onRemove: () => void;
}

/**
 * One account of the comparison. An item of « Mon patrimoine » shows its side
 * as a fixed label; a free row types its name and picks its side. Removing a
 * row only takes it out of this comparison.
 */
export function ReconcileAccountRow({
  row,
  number,
  currency,
  isUnreadable,
  autoFocus,
  onFocus,
  onChange,
  onLeaveAmount,
  onRemove,
}: ReconcileAccountRowProps) {
  const theme = useTheme();
  const v2 = useV2Colors();
  const financial = useFinancialColors();
  const { t } = useTranslation();
  const muted = { color: theme.colors.onSurfaceVariant };
  const isLinked = row.account.kind === "asset";
  const isOwed = row.side === "owe";
  // A focused field brings its whole row above the footer and the keyboard.
  const card = useRef<View>(null);
  const reveal = useRevealInSheet();
  function focus() {
    reveal(card.current);
    onFocus?.();
  }
  const symbol = CURRENCY_METADATA[currency].symbol;
  const name =
    row.label.trim() === ""
      ? t("home.reconcile.accounts.accountNumbered", { index: number })
      : row.label.trim();

  return (
    <View
      ref={card}
      style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
    >
      <View style={styles.header}>
        {isLinked ? (
          <>
            <Text variant="titleMedium" numberOfLines={1} style={styles.grow}>
              {row.label}
            </Text>
            {/* A fixed side: a small tag, not a control. */}
            <View
              style={[
                styles.sideTag,
                { backgroundColor: isOwed ? v2.overWash : v2.accentWash },
              ]}
            >
              <Text
                variant="labelMedium"
                style={{
                  color: isOwed ? financial.overBudget : v2.accentInk,
                }}
              >
                {t(`home.reconcile.accounts.${row.side}`)}
              </Text>
            </View>
          </>
        ) : (
          <TextInput
            mode="outlined"
            style={styles.grow}
            label={t("home.reconcile.accounts.accountName")}
            value={row.label}
            onChangeText={(label) => onChange({ label })}
            maxLength={ACCOUNT_NAME_MAX_LENGTH}
            autoFocus={autoFocus}
            onFocus={focus}
            onBlur={() => reveal(null)}
          />
        )}
        <IconButton
          icon="close"
          onPress={onRemove}
          style={styles.remove}
          accessibilityLabel={t("home.reconcile.accounts.remove", { name })}
          testID={`reconcile-remove-${row.id}`}
        />
      </View>
      {!isLinked && (
        <SegmentedPicker<RowSide>
          isOnCard
          value={row.side}
          onValueChange={(side) => onChange({ side })}
          accessibilityLabel={t("home.reconcile.accounts.side", { name })}
          buttons={[
            { value: "own", label: t("home.reconcile.accounts.own") },
            { value: "owe", label: t("home.reconcile.accounts.owe") },
          ]}
        />
      )}
      <View>
        <TextInput
          mode="outlined"
          label={t("home.reconcile.accounts.amount")}
          value={row.amountText}
          onChangeText={(amountText) => onChange({ amountText })}
          onFocus={focus}
          onBlur={() => {
            reveal(null);
            onLeaveAmount();
          }}
          keyboardType="numeric"
          error={isUnreadable}
          autoFocus={autoFocus && isLinked}
          // Paper puts `style` on the container: the digits are the input's own.
          contentStyle={TABULAR_DIGITS}
          // A debt reads as one: the amount is what I owe, counted against me.
          left={
            isOwed && !LEADING_MINUS.test(row.amountText) ? (
              <TextInput.Affix text="−" />
            ) : undefined
          }
          // Paper hides an affix while the field is empty and unfocused: this
          // one only keeps the room for the symbol drawn over it, always shown.
          // Inked as the field: Android draws a `transparent` text in the default
          // ink, a second « CHF » beside the one over it.
          right={
            <TextInput.Affix
              text={symbol}
              textStyle={{ color: theme.colors.background }}
            />
          }
        />
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={styles.currency}
        >
          <Text variant="bodyLarge" style={muted}>
            {symbol}
          </Text>
        </View>
      </View>
      {isUnreadable && (
        <FieldError visible>
          {t("home.reconcile.accounts.invalidAmount")}
        </FieldError>
      )}
      {isLinked && (
        <>
          {isOwed && (
            <Text
              variant="bodySmall"
              style={muted}
              textBreakStrategy="balanced"
            >
              {t("home.reconcile.accounts.cardCaption")}
            </Text>
          )}
          <Text variant="bodySmall" style={muted} textBreakStrategy="balanced">
            {t("home.reconcile.accounts.linkedCaption")}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, padding: SPACING.md, gap: SPACING.sm },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  grow: { flex: 1 },
  sideTag: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
  },
  remove: { width: TOUCH_TARGET, height: TOUCH_TARGET, margin: 0 },
  // Where Paper draws its own affix: past the outline's 6dp label notch, 16dp in.
  currency: {
    position: "absolute",
    top: 6,
    bottom: 0,
    right: SPACING.md,
    justifyContent: "center",
  },
});
