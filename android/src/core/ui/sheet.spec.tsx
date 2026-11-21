import { act, fireEvent, render } from "@testing-library/react-native";
import { DeviceEventEmitter, Dimensions, ScrollView, Text } from "react-native";
import { PaperProvider } from "react-native-paper";

import { readFileSync, sourceFiles } from "@/core/testing/source-files";

import { SHEET_HEIGHT_RATIO } from "./keyboard-inset";
import { FormModal } from "./sheet";
import { TOUCH_TARGET } from "./theme";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

/** Native modals are centralized here, except for the notification primer. */
const ALLOWED = [
  "src/core/ui/sheet.tsx",
  "src/core/system/system-gate-screen.tsx",
  "src/features/current-month/components/notification-prime-sheet.tsx",
];

const MUTATING = [
  "src/features/account/components/change-password-sheet.tsx",
  "src/features/account/components/confirm-password-sheet.tsx",
  "src/features/account/components/profile-sheet.tsx",
  "src/features/account/components/verify-recovery-key-sheet.tsx",
  "src/features/budget-details/components/budget-line-sheet.tsx",
  "src/features/budget-details/savings-withdrawal/components/savings-withdrawal-sheet.tsx",
  "src/features/budget-details/spread/components/spread-existing-sheet.tsx",
  "src/features/current-month/components/reconcile-accounts-sheet.tsx",
  "src/features/savings-goals/components/goal-deletion-sheet.tsx",
  "src/features/savings-goals/components/goal-form-sheet.tsx",
  "src/features/savings-goals/components/goal-generation-stop-sheet.tsx",
  "src/features/savings-goals/components/simulator/goal-plan-apply-recap.tsx",
  "src/features/templates/components/template-form-sheet.tsx",
  "src/features/templates/components/template-line-sheet.tsx",
  "src/features/transactions/components/transaction-sheet.tsx",
];

/**
 * Sixteen sheets each capped themselves at `maxHeight: "88%"`, and the keyboard
 * took the bottom third of a sheet that still believed it was full height:
 * the submit button went under it. Neither a percentage nor `useWindowDimensions`
 * shrinks for the keyboard — only the IME inset does, which is what
 * `keyboard-inset.ts` reads. `FormModal` owns that measurement and pins its
 * actions, so the fix has to hold for the next sheet too.
 */
describe("sheets", () => {
  async function renderModal(isBusy: boolean) {
    const onDismiss = jest.fn();
    const view = await render(
      <PaperProvider>
        <FormModal
          isVisible
          isBusy={isBusy}
          title="Form title"
          subtitle="Form subtitle"
          onDismiss={onDismiss}
          footer={<Text>Form footer</Text>}
        >
          <Text>Form body</Text>
        </FormModal>
      </PaperProvider>,
    );
    return { onDismiss, view };
  }

  it("shows its title, subtitle, body and pinned footer from the bottom edge", async () => {
    const { view } = await renderModal(false);

    for (const text of [
      "Form title",
      "Form subtitle",
      "Form body",
      "Form footer",
    ]) {
      expect(view.getByText(text)).toBeTruthy();
    }
    expect(view.queryByLabelText("common.back")).toBeNull();
    expect(view.getByTestId("form-modal").props.animationType).toBe("slide");
    expect(
      view.getByTestId("form-modal-backdrop", { includeHiddenElements: true })
        .parent,
    ).toHaveStyle({ justifyContent: "flex-end" });
  });

  it("keeps its tallest height across steps when asked to, and follows its content otherwise", async () => {
    const layout = (height: number) => ({
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height } },
    });
    const view = await render(
      <PaperProvider>
        <FormModal isVisible holdsHeight title="Steps" onDismiss={jest.fn()}>
          <Text>Step</Text>
        </FormModal>
      </PaperProvider>,
    );
    const sheet = () =>
      view.getByTestId("form-modal-sheet", { includeHiddenElements: true });

    await act(() => fireEvent(sheet(), "layout", layout(500)));
    await act(() => fireEvent(sheet(), "layout", layout(400)));
    expect(sheet()).toHaveStyle({ minHeight: 500 });

    const { view: plain } = await renderModal(false);
    const plainSheet = plain.getByTestId("form-modal-sheet", {
      includeHiddenElements: true,
    });
    await act(() => fireEvent(plainSheet, "layout", layout(500)));
    expect(plainSheet).toHaveStyle({ minHeight: 0 });
  });

  it("dismisses from its visible close, backdrop and Android back action", async () => {
    const { onDismiss, view } = await renderModal(false);
    const close = view.getByRole("button", { name: "common.close" });
    const backdrop = view.getByTestId("form-modal-backdrop", {
      includeHiddenElements: true,
    });
    expect(
      view.getAllByLabelText("common.close", { includeHiddenElements: true }),
    ).toEqual([close]);
    expect(backdrop).toHaveProp("importantForAccessibility", "no");
    expect(view.getByTestId("form-modal-close-container")).toHaveStyle({
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
    });

    await fireEvent.press(close);
    await fireEvent.press(backdrop);
    await act(() => fireEvent(view.getByTestId("form-modal"), "requestClose"));

    expect(onDismiss).toHaveBeenCalledTimes(3);
  });

  it("blocks every dismissal path while a write is pending", async () => {
    const { onDismiss, view } = await renderModal(true);

    const close = view.getByLabelText("common.close");
    expect(close.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
    expect(
      view.getByTestId("form-modal-backdrop", { includeHiddenElements: true })
        .props.onPress,
    ).toBeUndefined();
    await fireEvent.press(close);
    await act(() => fireEvent(view.getByTestId("form-modal"), "requestClose"));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("hands the Android back action to a multi-step form's own back", async () => {
    const onDismiss = jest.fn();
    const onBack = jest.fn();
    const view = await render(
      <PaperProvider>
        <FormModal
          isVisible
          title="Steps"
          onDismiss={onDismiss}
          onBack={onBack}
        >
          <Text>Step body</Text>
        </FormModal>
      </PaperProvider>,
    );

    expect(view.queryByLabelText("common.back")).toBeNull();
    await act(() => fireEvent(view.getByTestId("form-modal"), "requestClose"));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();

    await fireEvent.press(view.getByLabelText("common.close"));
    await fireEvent.press(
      view.getByTestId("form-modal-backdrop", { includeHiddenElements: true }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("shows a 48dp header back button when asked", async () => {
    const onBack = jest.fn();
    const view = await render(
      <PaperProvider>
        <FormModal
          isVisible
          title="Steps"
          onDismiss={jest.fn()}
          onBack={onBack}
          showsBackButton
        />
      </PaperProvider>,
    );
    const back = view.getByRole("button", { name: "common.back" });
    expect(view.getByTestId("form-modal-back-container")).toHaveStyle({
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
    });
    expect(view.getByRole("header", { name: "Steps" })).toBeOnTheScreen();

    await fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("puts the form back where it was, its top included, after a step", async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
    jest
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      });
    const sheet = (showsBackButton: boolean) => (
      <PaperProvider>
        <FormModal
          isVisible
          title="Steps"
          onDismiss={jest.fn()}
          onBack={jest.fn()}
          showsBackButton={showsBackButton}
        >
          <Text>Body</Text>
        </FormModal>
      </PaperProvider>
    );
    const scrollBy = (y: number) =>
      fireEvent.scroll(view.getByTestId("form-modal-body"), {
        nativeEvent: { contentOffset: { x: 0, y } },
      });
    const view = await render(sheet(false));

    await scrollBy(0);
    await view.rerender(sheet(true));
    await scrollBy(40);
    scrollTo.mockClear();
    await view.rerender(sheet(false));

    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
    scrollTo.mockRestore();
    jest.restoreAllMocks();
  });

  it("refuses the form's own back too while a write is pending", async () => {
    const onBack = jest.fn();
    const view = await render(
      <PaperProvider>
        <FormModal
          isVisible
          isBusy
          title="Steps"
          onDismiss={jest.fn()}
          onBack={onBack}
          showsBackButton
        >
          <Text>Step body</Text>
        </FormModal>
      </PaperProvider>,
    );

    const back = view.getByRole("button", { name: "common.back" });
    expect(back).toBeDisabled();
    await fireEvent.press(back);
    await act(() => fireEvent(view.getByTestId("form-modal"), "requestClose"));

    expect(onBack).not.toHaveBeenCalled();
  });

  it("uses the native accessible modal through the honest shared export", () => {
    const source = readFileSync("src/core/ui/sheet.tsx", "utf8");
    const legacyConsumers = sourceFiles("src").filter((path) => {
      const consumer = readFileSync(path, "utf8");
      return (
        consumer.includes('from "@/core/ui/sheet"') &&
        !consumer.includes("FormModal") &&
        !consumer.includes("useRevealInSheet")
      );
    });

    expect(source).toContain("Modal,\n  Pressable,");
    expect(source).not.toContain("Portal");
    expect(source).toContain("accessibilityViewIsModal");
    expect(legacyConsumers).toEqual([]);
  });

  it("marks every directly mutating sheet busy while its write is pending", () => {
    const unguarded = MUTATING.filter(
      (path) => !readFileSync(path, "utf8").includes("isBusy={"),
    );

    expect(unguarded).toEqual([]);
  });

  it("never re-implements the modal a sheet is made of", () => {
    const raw = sourceFiles("src").filter(
      (path) =>
        readFileSync(path, "utf8").includes("<Modal") &&
        !ALLOWED.includes(path),
    );

    expect(raw).toEqual([]);
  });

  it("never caps a sheet at a share of a window the keyboard does not shrink", () => {
    const capped = sourceFiles("src").filter((path) =>
      /maxHeight:\s*"\d+%"/.test(readFileSync(path, "utf8")),
    );

    expect(capped).toEqual([]);
  });

  it("never measures the window without also asking for the keyboard", () => {
    // Reading only the font scale sizes nothing the keyboard covers.
    const blind = sourceFiles("src").filter((path) => {
      const source = readFileSync(path, "utf8");
      return (
        /useWindowDimensions\(\)(?!\.fontScale)/.test(source) &&
        !source.includes("useKeyboardHeight")
      );
    });

    expect(blind).toEqual([]);
  });

  it("makes room for the keyboard while keeping the footer available", async () => {
    const { view } = await renderModal(false);
    const sheet = view.getByTestId("form-modal-sheet");
    const { height } = Dimensions.get("window");
    const keyboardHeight = 240;

    await act(() => {
      DeviceEventEmitter.emit("keyboardDidShow", {
        endCoordinates: { height: keyboardHeight },
      });
    });
    expect(sheet).toHaveStyle({
      marginBottom: keyboardHeight,
      maxHeight: (height - keyboardHeight) * SHEET_HEIGHT_RATIO,
    });
    expect(view.getByText("Form footer")).toBeOnTheScreen();

    await act(() => DeviceEventEmitter.emit("keyboardDidHide"));
    expect(sheet).toHaveStyle({ marginBottom: 0 });
  });
});
