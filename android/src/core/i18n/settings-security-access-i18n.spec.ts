import { i18n, translate } from "./i18n";

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

describe("settings security access localization", () => {
  it.each([
    ["fr", "Sécurité", "Empreinte digitale"],
    ["en", "Security", "Fingerprint"],
    ["de", "Sicherheit", "Fingerabdruck"],
    ["it", "Sicurezza", "Impronta digitale"],
  ])("serves access and biometric copy in %s", (locale, title, biometric) => {
    i18n.locale = locale;
    expect(translate("settings.security.title")).toBe(title);
    expect(translate("settings.security.biometric.fingerprint")).toBe(
      biometric,
    );
  });

  it("classifies failures by stable codes and locks pending dialogs", () => {
    const pin = readFileSync("src/app/(main)/settings/change-pin.tsx", "utf8");
    const screen = readFileSync("src/app/(main)/settings/security.tsx", "utf8");
    const password = readFileSync(
      "src/features/account/components/change-password-sheet.tsx",
      "utf8",
    );

    expect(pin).toContain("API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED");
    expect(password).toContain("isInvalidCredentials(error)");
    expect(screen).toContain("if (!isBiometricBusy)");
    expect(screen).toContain("finally {");
    expect(`${pin}\n${password}`).not.toContain(
      "normalizeApiError(error).message",
    );
  });
});
