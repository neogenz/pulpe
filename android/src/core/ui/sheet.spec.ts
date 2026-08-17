import { readFileSync, sourceFiles } from "@/core/testing/source-files";

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
 * `keyboard-inset.ts` reads. `Sheet` owns that measurement and pins its
 * actions, so the fix has to hold for the next sheet too.
 */
describe("sheets", () => {
  it("uses the native accessible modal and blocks dismissal while busy", () => {
    const source = readFileSync("src/core/ui/sheet.tsx", "utf8");

    expect(source).toContain("Modal,\n  Pressable,");
    expect(source).not.toContain("Portal");
    expect(source).toContain("accessibilityViewIsModal");
    expect(source).toContain(
      "onRequestClose={isBusy ? () => undefined : onDismiss}",
    );
    expect(source).toContain("onPress={isBusy ? undefined : onDismiss}");
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
