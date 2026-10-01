import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { PaperProvider } from "react-native-paper";

import TagsSettingsScreen from "@/app/(main)/settings/tags";

let mockKeyboardHeight = 0;
const mockMutation = () => ({
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
});

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("@/core/ui/keyboard-inset", () => ({
  useKeyboardHeight: () => mockKeyboardHeight,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/screen-app-bar", () => ({
  ScreenAppBar: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/features/tags/tag-queries", () => ({
  useTags: () => ({
    data: [{ id: "tag-1", name: "Vacances" }],
    isPending: false,
    isError: false,
    isRefetching: false,
    refetch: jest.fn(),
  }),
  useCreateTag: () => mockMutation(),
  useRenameTag: () => mockMutation(),
  useDeleteTag: () => mockMutation(),
}));

type Element = ReturnType<Awaited<ReturnType<typeof render>>["getByText"]>;

/** The vertical shift applied to the closest transformed element up the tree. */
function liftAround(element: Element): number | undefined {
  let node: Element | null = element;
  while (node !== null) {
    const { transform } = StyleSheet.flatten(node.props.style) ?? {};
    if (Array.isArray(transform)) {
      const shift = transform.find(
        (entry): entry is { translateY: number } => "translateY" in entry,
      );
      if (shift !== undefined) return shift.translateY;
    }
    node = node.parent;
  }
  return undefined;
}

function screen() {
  return (
    <PaperProvider>
      <TagsSettingsScreen />
    </PaperProvider>
  );
}

beforeEach(() => {
  mockKeyboardHeight = 0;
});

/**
 * The rename field is autofocused, so the keyboard opens with the dialog —
 * and Paper's Dialog, centred in a window that does not shrink for it, put
 * the rename action under the keys.
 */
it("lifts the rename dialog clear of the keyboard its field opens", async () => {
  const view = await render(screen());
  await fireEvent.press(view.getByLabelText("settings.tags.renameA11y"));
  expect(liftAround(view.getByText("settings.tags.rename"))).toBeCloseTo(0);

  mockKeyboardHeight = 280;
  await view.rerender(screen());

  expect(liftAround(view.getByText("settings.tags.rename"))).toBe(-140);
});
