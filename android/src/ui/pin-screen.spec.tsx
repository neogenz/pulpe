import { render } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { PaperProvider } from "react-native-paper";

import { PinScreen } from "./pin-screen";

let mockKeyboardHeight = 0;

jest.mock("@/core/ui/keyboard-inset", () => ({
  useKeyboardHeight: () => mockKeyboardHeight,
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  SafeAreaView: jest.requireActual("react-native").View,
}));

type Element = ReturnType<Awaited<ReturnType<typeof render>>["getByText"]>;

/**
 * The nearest bottom padding up the tree. Jest's ScrollView keeps its content
 * style as a prop rather than drawing the inner view it styles natively.
 */
function bottomPaddingAround(element: Element): unknown {
  let node: Element | null = element;
  while (node !== null) {
    for (const style of [node.props.contentContainerStyle, node.props.style]) {
      const { paddingBottom } = StyleSheet.flatten(style) ?? {};
      if (paddingBottom !== undefined) return paddingBottom;
    }
    node = node.parent;
  }
  return undefined;
}

function recoveryStep() {
  return (
    <PaperProvider>
      <PinScreen title="Recovery" footer={<Text>Contact support</Text>}>
        <Text>Recovery key field</Text>
      </PinScreen>
    </PaperProvider>
  );
}

beforeEach(() => {
  mockKeyboardHeight = 0;
});

/**
 * The recovery key is typed with the system keyboard, and the edge-to-edge
 * window does not shrink for it: the vertically centred field and its
 * "Continuer" ended up under the keys.
 */
it("recentres the step above the keyboard and leaves it as it was without one", async () => {
  const view = await render(recoveryStep());
  expect(bottomPaddingAround(view.getByText("Recovery key field"))).toBe(0);

  mockKeyboardHeight = 320;
  await view.rerender(recoveryStep());

  expect(bottomPaddingAround(view.getByText("Recovery key field"))).toBe(320);
  expect(view.getByText("Contact support")).toBeTruthy();
});
