import { render } from "@testing-library/react-native";

import { parseNote, Release } from "./whats-new-sheet";

jest.mock("./whats-new-store", () => ({}));
jest.mock("./system-store", () => ({ CURRENT_APP_VERSION: "0.60.0" }));
jest.mock("@/core/auth/session-store", () => ({}));
jest.mock("@/core/vault/vault-store", () => ({}));
jest.mock("@/core/ui/sheet", () => ({}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

it("splits a feed line into its title and detail, without markdown", () => {
  expect(parseNote("- **Pointage** — Plus rapide")).toEqual({
    title: "Pointage",
    detail: "Plus rapide",
  });
  expect(parseNote("- Sans titre, **gras**")).toEqual({
    detail: "Sans titre, gras",
  });
});

it("renders one note per line, and the version only for an aggregate", async () => {
  const body =
    "- **Planifier** — Jusqu’à 36 budgets\n- **Pointage** — Plus rapide";
  const view = await render(
    <Release version="0.60.0" body={body} showVersion={false} />,
  );

  expect(view.getByText("Planifier")).toBeTruthy();
  expect(view.getByText("Plus rapide")).toBeTruthy();
  expect(view.queryByText("system.whatsNew.version")).toBeNull();

  await view.rerender(<Release version="0.60.0" body={body} showVersion />);
  expect(view.getByText("system.whatsNew.version")).toBeTruthy();
});
