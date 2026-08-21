import { i18n, translate } from "./i18n";

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

describe("final pre-main localization", () => {
  it.each([
    ["fr", "Étape 2 sur 5", "Copier la clé"],
    ["en", "Step 2 of 5", "Copy the key"],
    ["de", "Schritt 2 von 5", "Schlüssel kopieren"],
    ["it", "Passaggio 2 di 5", "Copia la chiave"],
  ])("serves progress and recovery copy in %s", (locale, progress, copy) => {
    i18n.locale = locale;
    expect(translate("onboarding.progress", { current: 2, total: 5 })).toBe(
      progress,
    );
    expect(translate("vault.notice.copy")).toBe(copy);
  });

  it("has no optional French presentation path or raw vault error state", () => {
    const paths = [
      "src/ui/recovery-key-notice.tsx",
      "src/features/onboarding/components/progress-dots.tsx",
      "src/features/onboarding/components/transaction-dialog.tsx",
      "src/features/onboarding/components/transaction-list.tsx",
      "src/features/onboarding/components/legal-consent.tsx",
    ];
    const presentation = paths
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    const vault = readFileSync("src/core/vault/vault-store.ts", "utf8");

    expect(presentation).not.toContain("localized");
    expect(presentation).not.toMatch(/Clé de récupération|Étape \$|Annuler/);
    expect(vault).toContain("hasBootstrapError: true");
    expect(vault).not.toContain("normalizeApiError");
  });
});
