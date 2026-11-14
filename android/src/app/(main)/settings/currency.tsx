import { useKeyboardHeight } from "@/core/ui/keyboard-inset";
import { router } from "expo-router";
import {
  CURRENCY_METADATA,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from "pulpe-shared";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Dialog,
  Portal,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatIsoDate } from "@/core/ui/date-format";
import {
  captureCurrencyChanged,
  captureCurrencySelectorToggled,
} from "@/core/observability/product-events";
import { formatCurrency } from "@/core/ui/amount-format";
import { Card } from "@/core/ui/card";
import { Notice } from "@/core/ui/notice";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import { SegmentedPicker } from "@/core/ui/segmented-picker";
import { SPACING } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { useUpdateUserSettings } from "@/features/account/account-queries";
import { convertTypedAmount } from "@/features/account/currency-converter";
import { useCurrencyRate } from "@/features/account/currency-queries";
import { SettingsSection } from "@/features/account/components/settings-section";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";
const RATE_DECIMALS = 4;

/**
 * The display currency and a converter beside it, as `CurrencySettingView` on
 * iOS. Changing the currency converts nothing: only the symbol changes.
 */
export default function CurrencyScreen() {
  const theme = useTheme();
  const keyboardHeight = useKeyboardHeight();
  const { locale, t } = useTranslation();
  const settings = useUserSettings();
  const update = useUpdateUserSettings();
  const [pending, setPending] = useState<SupportedCurrency | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [input, setInput] = useState("");

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const target =
    SUPPORTED_CURRENCIES.find((candidate) => candidate !== currency) ??
    currency;
  const rate = useCurrencyRate(currency, target);
  const converted = convertTypedAmount(input, rate.data?.rate);

  function apply(next: SupportedCurrency) {
    setPending(null);
    update.mutate(
      { currency: next },
      {
        onSuccess: () => {
          captureCurrencyChanged(currency, next);
          setNotice(
            t("settings.currency.saved", {
              symbol: CURRENCY_METADATA[next].symbol,
            }),
          );
        },
        onError: () => setNotice(t("settings.currency.saveError")),
      },
    );
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel={t("common.back")}
        />
        <Appbar.Content title={t("settings.preferences.currencyTitle")} />
      </ScreenAppBar>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SPACING.xxl + keyboardHeight },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.block}>
          <SegmentedPicker
            value={currency}
            onValueChange={(next) => {
              if (next !== currency) setPending(next);
            }}
            buttons={SUPPORTED_CURRENCIES.map((candidate) => ({
              value: candidate,
              // CHF's symbol is its own code: say it once.
              label:
                CURRENCY_METADATA[candidate].symbol === candidate
                  ? candidate
                  : `${candidate} · ${CURRENCY_METADATA[candidate].symbol}`,
              disabled: update.isPending,
            }))}
          />
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("settings.currency.description")}
          </Text>
        </View>

        {/* Without it the currency field never shows in the movement sheet. */}
        <Card mode="contained">
          <Card.Content style={styles.switchRow}>
            <View style={styles.switchLabels}>
              <Text variant="bodyLarge">
                {t("settings.currency.selectorTitle")}
              </Text>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("settings.currency.selectorDescription")}
              </Text>
            </View>
            <Switch
              value={settings.data?.showCurrencySelector === true}
              disabled={update.isPending}
              onValueChange={(next) =>
                update.mutate(
                  { showCurrencySelector: next },
                  {
                    onSuccess: () => captureCurrencySelectorToggled(next),
                    onError: () => setNotice(t("settings.currency.saveError")),
                  },
                )
              }
              accessibilityLabel={t("settings.currency.selectorTitle")}
            />
          </Card.Content>
        </Card>

        <SettingsSection title={t("settings.currency.converter.title")}>
          <View style={styles.converter}>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("settings.currency.converter.hint")}
            </Text>
            <TextInput
              mode="outlined"
              label={t("settings.currency.converter.from")}
              right={<TextInput.Affix text={currency} />}
              value={input}
              onChangeText={setInput}
              keyboardType="decimal-pad"
              placeholder="0"
              accessibilityLabel={t("settings.currency.converter.input", {
                currency,
              })}
            />
            <TextInput
              mode="outlined"
              label={t("settings.currency.converter.to")}
              right={<TextInput.Affix text={target} />}
              value={
                converted === null ? "—" : formatCurrency(converted, target)
              }
              editable={false}
              accessibilityLabel={t("settings.currency.converter.output", {
                currency: target,
              })}
            />
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("settings.currency.converter.auto")}
            </Text>
            <RateFooter
              isLoading={rate.isFetching}
              hasFailed={rate.isError}
              onRetry={() => void rate.refetch()}
              info={
                rate.data === undefined
                  ? null
                  : t("settings.currency.converter.rate", {
                      base: rate.data.base,
                      rate: rate.data.rate.toFixed(RATE_DECIMALS),
                      target: rate.data.target,
                      date: formatIsoDate(rate.data.date, locale),
                    })
              }
            />
          </View>
        </SettingsSection>
      </ScrollView>

      <Portal>
        <Dialog visible={pending !== null} onDismiss={() => setPending(null)}>
          <Dialog.Title>
            {t("settings.currency.confirmTitle", { currency: pending ?? "" })}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t("settings.currency.confirmBody", {
                symbol:
                  pending === null ? "" : CURRENCY_METADATA[pending].symbol,
              })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPending(null)}>
              {t("settings.currency.keep", { currency })}
            </Button>
            <Button
              onPress={() => {
                if (pending !== null) apply(pending);
              }}
            >
              {t("settings.currency.show", { currency: pending ?? "" })}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Notice visible={notice !== null} onDismiss={() => setNotice(null)}>
        {notice ?? ""}
      </Notice>
    </SafeAreaView>
  );
}

function RateFooter({
  isLoading,
  hasFailed,
  info,
  onRetry,
}: {
  isLoading: boolean;
  hasFailed: boolean;
  info: string | null;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = { color: theme.colors.onSurfaceVariant };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" />
        <Text variant="bodySmall" style={muted}>
          {t("settings.currency.converter.loading")}
        </Text>
      </View>
    );
  }
  if (hasFailed) {
    return (
      <View style={styles.block}>
        <Text variant="bodySmall" style={muted}>
          {t("settings.currency.converter.failed")}
        </Text>
        <Button mode="text" compact onPress={onRetry}>
          {t("settings.currency.converter.retry")}
        </Button>
      </View>
    );
  }
  return info === null ? null : (
    <Text variant="bodySmall" style={muted}>
      {info}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xxl },
  block: { gap: SPACING.sm },
  switchRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  switchLabels: { flex: 1, gap: SPACING.xxs },
  converter: { gap: SPACING.sm, padding: SPACING.md },
  loading: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
});
