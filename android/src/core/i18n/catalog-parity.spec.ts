import de from "./catalogs/de.json";
import en from "./catalogs/en.json";
import fr from "./catalogs/fr.json";
import italian from "./catalogs/it.json";
import { i18n } from "./i18n";

const catalogs = { de, en, fr, it: italian };

function flattenCatalog(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") {
    if (prefix.length === 0)
      throw new Error("A catalog root must be an object");
    return { [prefix]: value };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${prefix || "catalog"} must be an object or a string`);
  }

  return Object.entries(value).reduce<Record<string, string>>(
    (result, [key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      Object.assign(result, flattenCatalog(child, path));
      return result;
    },
    {},
  );
}

describe("Android locale catalogs", () => {
  afterAll(() => {
    i18n.locale = "fr";
  });

  it("keep the same non-empty string keys in every language", () => {
    const french = flattenCatalog(fr);
    const expectedKeys = Object.keys(french).sort();

    for (const [locale, catalog] of Object.entries(catalogs)) {
      const entries = flattenCatalog(catalog);
      expect(Object.keys(entries).sort()).toEqual(expectedKeys);
      expect(
        Object.values(entries).every((value) => value.trim().length > 0),
      ).toBe(true);
      i18n.locale = locale;
      for (const key of expectedKeys) {
        const output = i18n.t(key);
        expect(typeof output).toBe("string");
        expect(output).not.toMatch(/^\[missing .+ translation\]$/);
      }
    }
  });
});
