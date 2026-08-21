import { i18n, translate, translateForLocale } from "./i18n";
import {
  applyServerLocale,
  clearLocaleSnapshot,
  resolveLocale,
  setLocale,
  useLocaleStore,
} from "./locale-store";

jest.mock("expo-localization", () => {
  const deviceTags = ["de-CH"];
  return {
    __deviceTags: deviceTags,
    getLocales: () =>
      deviceTags.map((languageTag) => ({ languageCode: null, languageTag })),
  };
});
jest.mock("react-native-mmkv", () => {
  const storage = new Map<string, string>();
  return {
    __storage: storage,
    createMMKV: () => ({
      getString: (key: string) => storage.get(key),
      remove: (key: string) => storage.delete(key),
      set: (key: string, value: string) => storage.set(key, value),
    }),
  };
});

const mockStorage = jest.requireMock<{ __storage: Map<string, string> }>(
  "react-native-mmkv",
).__storage;
const mockDeviceTags = jest.requireMock<{ __deviceTags: string[] }>(
  "expo-localization",
).__deviceTags;

beforeEach(() => {
  mockStorage.clear();
  mockDeviceTags.splice(0, mockDeviceTags.length, "de-CH");
  clearLocaleSnapshot();
});

describe("locale store", () => {
  it("resolves snapshot, ordered device languages, then French", () => {
    expect(resolveLocale("it", ["de-CH"])).toBe("it");
    expect(resolveLocale(undefined, ["es-ES", "en_GB"])).toBe("en");
    expect(resolveLocale("es", ["pt-BR"])).toBe("fr");
  });

  it("applies a present server locale and preserves boot locale when absent", () => {
    applyServerLocale("it");
    expect(useLocaleStore.getState().locale).toBe("it");
    expect(mockStorage.get("pulpe-settings-language")).toBe("it");

    applyServerLocale(undefined);
    expect(useLocaleStore.getState().locale).toBe("it");
  });

  it("clears the departing account snapshot and returns to the device locale", () => {
    setLocale("it");
    mockDeviceTags.splice(0, mockDeviceTags.length, "en-US");

    clearLocaleSnapshot();

    expect(mockStorage.has("pulpe-settings-language")).toBe(false);
    expect(useLocaleStore.getState().locale).toBe("en");
  });

  it("notifies subscribers and falls back to French for a missing key", () => {
    const listener = jest.fn();
    const unsubscribe = useLocaleStore.subscribe(listener);
    const english = i18n.translations.en;

    setLocale("en");
    i18n.translations.en = {};

    expect(listener).toHaveBeenCalled();
    expect(translate("common.loading")).toBe("Chargement…");

    i18n.translations.en = english;
    unsubscribe();
  });

  it("translates from the subscribed locale instead of mutable global state", () => {
    i18n.locale = "fr";

    expect(translateForLocale("en", "common.loading")).toBe("Loading…");
    expect(i18n.locale).toBe("fr");
  });
});
