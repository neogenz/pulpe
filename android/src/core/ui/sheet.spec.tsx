import { act, fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { PaperProvider } from "react-native-paper";

import { readFileSync, sourceFiles } from "@/core/testing/source-files";

import { FormModal } from "./sheet";

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
    expect(view.getByTestId("form-modal").props.animationType).toBe("slide");
    expect(
      view.getByTestId("form-modal-backdrop", { includeHiddenElements: true })
        .parent,
    ).toHaveStyle({ justifyContent: "flex-end" });
  });

  it("dismisses from its visible close, backdrop and Android back action", async () => {
    const { onDismiss, view } = await renderModal(false);

    await fireEvent.press(view.getByLabelText("common.close"));
    await fireEvent.press(
      view.getByTestId("form-modal-backdrop", { includeHiddenElements: true }),
    );
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

  it("uses the native accessible modal through the honest shared export", () => {
    const source = readFileSync("src/core/ui/sheet.tsx", "utf8");
    const legacyConsumers = sourceFiles("src").filter((path) => {
      const consumer = readFileSync(path, "utf8");
      return (
        consumer.includes('from "@/core/ui/sheet"') &&
        !consumer.includes("FormModal")
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
    const blind = sourceFiles("src").filter((path) => {
      const source = readFileSync(path, "utf8");
      return (
        source.includes("useWindowDimensions") &&
        !source.includes("useKeyboardHeight")
      );
    });

    expect(blind).toEqual([]);
  });
});
