import { getLocales } from "expo-localization";
import {
  DEFAULT_LOCALE,
  supportedLocaleSchema,
  type SupportedLocale,
} from "pulpe-shared";
import { useCallback } from "react";
import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";

import { i18n, translate, translateForLocale } from "./i18n";
import { languageWriter } from "./language-writer";

const SNAPSHOT_KEY = "pulpe-settings-language";
const storage = createMMKV({ id: "pulpe-locale" });

function deviceLanguageTags(): string[] {
  return getLocales().map(
    ({ languageCode, languageTag }) => languageCode ?? languageTag,
  );
}

export function resolveLocale(
  snapshot: string | undefined,
  deviceTags: readonly string[],
): SupportedLocale {
  const saved = supportedLocaleSchema.safeParse(snapshot);
  if (saved.success) return saved.data;

  for (const tag of deviceTags) {
    const locale = supportedLocaleSchema.safeParse(
      tag.toLowerCase().split(/[-_]/, 1)[0],
    );
    if (locale.success) return locale.data;
  }
  return DEFAULT_LOCALE;
}

interface LocaleState {
  isWritePending: boolean;
  locale: SupportedLocale;
}

const bootLocale = resolveLocale(
  storage.getString(SNAPSHOT_KEY),
  deviceLanguageTags(),
);
i18n.locale = bootLocale;

export const useLocaleStore = create<LocaleState>(() => ({
  isWritePending: false,
  locale: bootLocale,
}));

export function setLocale(locale: SupportedLocale): void {
  storage.set(SNAPSHOT_KEY, locale);
  i18n.locale = locale;
  useLocaleStore.setState({ locale });
}

export function applyServerLocale(locale?: SupportedLocale): void {
  if (locale !== undefined) setLocale(locale);
}

export function setLocaleWritePending(isWritePending: boolean): void {
  useLocaleStore.setState({ isWritePending });
}

export function clearLocaleSnapshot(): void {
  languageWriter.invalidate();
  storage.remove(SNAPSHOT_KEY);
  const locale = resolveLocale(undefined, deviceLanguageTags());
  i18n.locale = locale;
  useLocaleStore.setState({ isWritePending: false, locale });
}

export function useTranslation() {
  const locale = useLocaleStore((state) => state.locale);
  const t = useCallback<typeof translate>(
    (key, options) => translateForLocale(locale, key, options),
    [locale],
  );
  return { locale, t };
}
