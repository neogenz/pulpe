import { render } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { PaperProvider } from "react-native-paper";

import { SCREEN_PADDING } from "@/core/ui/theme";

import { StepScaffold } from "./step-scaffold";

let mockKeyboardHeight = 0;

jest.mock("@/core/ui/keyboard-inset", () => ({
  useKeyboardHeight: () => mockKeyboardHeight,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/ui/haptics", () => ({ hapticCommit: jest.fn() }));
// The store persists a draft through the native crypto binding; only the step
// it is on matters to the frame.
jest.mock("../onboarding-store", () => ({
  useOnboardingStore: () => ({ currentStep: "charges", editReturnStep: null }),
  goToPreviousStep: jest.fn(),
}));
jest.mock("../onboarding-selectors", () => ({
  isStepInProgressBar: () => false,
  progressBarSteps: () => [],
  wouldExitOnBack: () => false,
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  SafeAreaView: jest.requireActual("react-native").View,
}));

type Element = ReturnType<Awaited<ReturnType<typeof render>>["getByText"]>;

/** The nearest element up the tree that sets a bottom padding. */
function bottomPaddingAround(element: Element): unknown {
  let node: Element | null = element;
  while (node !== null) {
    const style = StyleSheet.flatten(node.props.style);
    if (style?.paddingBottom !== undefined) return style.paddingBottom;
    node = node.parent;
  }
  return undefined;
}

function step() {
  return (
    <PaperProvider>
      <StepScaffold
        title="Step title"
        subtitle="Step subtitle"
        ctaLabel="Continue"
        isCtaEnabled
        onContinue={jest.fn()}
        footer={<Text>Step footer</Text>}
      >
        <Text>Step field</Text>
      </StepScaffold>
    </PaperProvider>
  );
}

beforeEach(() => {
  mockKeyboardHeight = 0;
});

/**
 * Edge to edge, the window keeps its full height under the IME, so the CTA
 * pinned under the scroll stayed under the keys while a field was typed in.
 */
it("lifts the pinned actions above the keyboard while it is up", async () => {
  const view = await render(step());
  expect(bottomPaddingAround(view.getByText("Step footer"))).toBe(
    SCREEN_PADDING,
  );

  mockKeyboardHeight = 300;
  await view.rerender(step());

  expect(bottomPaddingAround(view.getByText("Step footer"))).toBe(
    SCREEN_PADDING + 300,
  );
  expect(view.getByText("Continue")).toBeTruthy();
});
