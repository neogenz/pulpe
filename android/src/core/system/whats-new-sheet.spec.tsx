import { render } from "@testing-library/react-native";

import { Release } from "./whats-new-sheet";

jest.mock("./whats-new-store", () => ({}));
jest.mock("@/core/auth/session-store", () => ({}));
jest.mock("@/core/vault/vault-store", () => ({}));
jest.mock("@/core/i18n/locale-store", () => ({}));

it("renders each `- ` line of the feed as a bullet, without markdown", async () => {
  const view = await render(
    <Release
      title="Nouveautés de la version 0.49.0"
      body={
        "- **Planifier plusieurs mois** — Crée jusqu’à 36 budgets\n- **Pointage** — Plus rapide"
      }
    />,
  );

  expect(
    view.getByText("Planifier plusieurs mois — Crée jusqu’à 36 budgets"),
  ).toBeTruthy();
  expect(view.getByText("Pointage — Plus rapide")).toBeTruthy();
  expect(view.getAllByText("•")).toHaveLength(2);
  expect(view.queryByText(/^- |\*\*/)).toBeNull();
});
