import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import { contractAssets, LIVRET } from "@/core/testing/net-worth-accounts";

import { accountChoices } from "../account-link";
import { AccountField } from "./account-field";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string, options?: Record<string, unknown>) =>
      jest
        .requireActual("@/core/i18n/i18n")
        .translateForLocale("fr", key, options),
  }),
}));
jest.mock("@/core/ui/ripple", () => ({ useRipple: () => ({}) }));

describe("AccountField (CA25)", () => {
  it("names the element chosen twice and keeps the action", async () => {
    const view = await render(
      <PaperProvider>
        <AccountField
          choices={accountChoices(contractAssets())}
          value={LIVRET}
          onChange={jest.fn()}
          link={LIVRET}
        />
      </PaperProvider>,
    );

    expect(
      view.getByText(
        "Choisis un autre compte : « Livret » est déjà l'élément lié.",
      ),
    ).toBeTruthy();
  });
});

describe("AccountField for TalkBack", () => {
  it("is one button: the value and the arrow inside are not stops of their own", async () => {
    const view = await render(
      <PaperProvider>
        <AccountField
          choices={accountChoices(contractAssets())}
          value={LIVRET}
          onChange={jest.fn()}
        />
      </PaperProvider>,
    );

    expect(view.getByRole("button", { name: "Compte, Livret" })).toBeTruthy();
    expect(
      view.queryByDisplayValue("Livret", { includeHiddenElements: false }),
    ).toBeNull();
    expect(
      view.queryAllByRole("button", { includeHiddenElements: false }),
    ).toHaveLength(1);
  });
});
