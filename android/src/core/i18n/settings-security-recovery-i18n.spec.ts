import { i18n, translate } from "./i18n";

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

describe("settings security recovery localization", () => {
  it.each([
    ["fr", "Clé de récupération", "Supprimer mon compte"],
    ["en", "Recovery key", "Delete my account"],
    ["de", "Wiederherstellungsschlüssel", "Mein Konto löschen"],
    ["it", "Chiave di recupero", "Elimina il mio account"],
  ])(
    "serves recovery and deletion copy in %s",
    (locale, recovery, deletion) => {
      i18n.locale = locale;
      expect(translate("settings.security.recoverySection")).toBe(recovery);
      expect(translate("settings.security.deleteAccountTitle")).toBe(deletion);
    },
  );

  it("uses stable recovery codes and locks account deletion while pending", () => {
    const verify = readFileSync(
      "src/features/account/components/verify-recovery-key-sheet.tsx",
      "utf8",
    );
    const confirm = readFileSync(
      "src/features/account/components/confirm-password-sheet.tsx",
      "utf8",
    );
    const screen = readFileSync("src/app/(main)/settings/security.tsx", "utf8");

    expect(verify).toContain("API_ERROR_CODES.RECOVERY_KEY_INVALID");
    expect(verify).toContain("API_ERROR_CODES.RECOVERY_KEY_NOT_CONFIGURED");
    expect(confirm).toContain("isInvalidCredentials(error)");
    expect(screen).toContain("if (!removeAccount.isPending)");
    expect(screen).toContain("disabled={removeAccount.isPending}");
    expect(`${verify}\n${confirm}`).not.toContain(
      "normalizeApiError(error).message",
    );
  });
});
