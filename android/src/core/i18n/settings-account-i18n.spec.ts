import { i18n, translate } from "./i18n";

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

const titles = {
  fr: ["Compte", "Ton profil"],
  en: ["Account", "Your profile"],
  de: ["Konto", "Dein Profil"],
  it: ["Account", "Il tuo profilo"],
} as const;

describe("settings account localization", () => {
  it.each(Object.entries(titles))(
    "serves account and profile copy in %s",
    (locale, expected) => {
      i18n.locale = locale;
      expect([
        translate("settings.account.title"),
        translate("settings.account.profile.title"),
      ]).toEqual(expected);
    },
  );

  it("keeps the touched presentation surfaces behind catalog keys", () => {
    const account = readFileSync("src/app/(main)/settings/index.tsx", "utf8");
    const profile = readFileSync(
      "src/features/account/components/profile-sheet.tsx",
      "utf8",
    );

    expect(account).toContain('t("settings.account.title")');
    expect(account).toContain('t("settings.account.signOut.description")');
    expect(profile).toContain('t("settings.account.profile.saveError")');
    expect(`${account}\n${profile}`).not.toMatch(
      /title="Compte"|Modifier mon profil|title="Ton profil"/,
    );
  });
});
