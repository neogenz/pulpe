import de from "./catalogs/de.json";
import en from "./catalogs/en.json";
import fr from "./catalogs/fr.json";
import italian from "./catalogs/it.json";

const catalogs = { de, en, fr, it: italian };

function flatten(
  value: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  return Object.entries(value).reduce<Record<string, string>>(
    (result, [key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof child === "string") result[path] = child;
      else if (child && typeof child === "object") {
        Object.assign(result, flatten(child as Record<string, unknown>, path));
      }
      return result;
    },
    {},
  );
}

describe("Android locale catalogs", () => {
  it("keep the same non-empty keys in every language", () => {
    const french = flatten(fr);
    const expectedKeys = Object.keys(french).sort();

    for (const catalog of Object.values(catalogs)) {
      const entries = flatten(catalog);
      expect(Object.keys(entries).sort()).toEqual(expectedKeys);
      expect(
        Object.values(entries).every((value) => value.trim().length > 0),
      ).toBe(true);
    }
  });
});
