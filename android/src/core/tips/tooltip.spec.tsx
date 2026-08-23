import type { SupportedLocale } from "pulpe-shared";
import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import { setLocale } from "@/core/i18n/locale-store";

import { Tooltip } from "./tooltip";
import { useTipsStore } from "./tips-store";

const labels: readonly [SupportedLocale, string][] = [
  ["fr", "Fermer"],
  ["en", "Close"],
  ["de", "Schliessen"],
  ["it", "Chiudi"],
];

beforeEach(() => {
  useTipsStore.setState({ dismissedIds: [], armedIds: [] });
});

it.each(labels)("announces its close action in %s", async (locale, label) => {
  setLocale(locale);

  const view = await render(
    <PaperProvider>
      <Tooltip
        id="gestures"
        title="Title"
        message="Message"
        icon="gesture-swipe"
      />
    </PaperProvider>,
  );

  expect(view.getByLabelText(label)).toBeTruthy();
});
