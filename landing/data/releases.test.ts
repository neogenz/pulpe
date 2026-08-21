import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { releasesForLocale } from "@/components/pages/Changelog";

const releases = JSON.parse(
  readFileSync(new URL("./releases.json", import.meta.url), "utf8"),
) as Array<Record<string, unknown>>;

const localeMarkers = {
  en: "Consistent language settings",
  de: "Einheitliche Spracheinstellung",
  it: "Impostazione della lingua coerente",
} as const;

describe("localized release data", () => {
  it("keeps the complete history on the canonical French page", () => {
    assert.equal(releasesForLocale("fr").length, releases.length);
  });

  for (const [locale, marker] of Object.entries(localeMarkers)) {
    it(`renders only fully translated releases on the ${locale} page`, () => {
      const localized = releasesForLocale(locale as keyof typeof localeMarkers);

      assert.deepEqual(
        localized.map(({ version }) => version),
        ["0.46.0", "0.45.1", "0.45.0", "0.44.0"],
      );
      assert.equal(localized[0]?.changes.fixes[0]?.title, marker);
    });
  }

  it("keeps every localized category complete and structurally aligned", () => {
    const latest = releases[0] as {
      changes: Record<string, Array<{ title: string; description: string }>>;
      translations: Record<
        string,
        {
          changes: Record<
            string,
            Array<{ title: string; description: string }>
          >;
        }
      >;
    };

    assert.deepEqual(Object.keys(latest.translations).sort(), [
      "de",
      "en",
      "it",
    ]);
    for (const translation of Object.values(latest.translations)) {
      assert.deepEqual(
        Object.keys(translation.changes).sort(),
        Object.keys(latest.changes).sort(),
      );
      for (const category of Object.keys(latest.changes)) {
        const items = translation.changes[category] ?? [];
        assert.equal(items.length, latest.changes[category]?.length);
        assert.ok(
          items.every(
            ({ title, description }) =>
              title.trim().length > 0 && description.trim().length > 0,
          ),
        );
      }
    }
  });
});
