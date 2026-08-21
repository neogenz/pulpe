import { readFileSync } from "@/core/testing/source-files";

const route = readFileSync("src/app/(onboarding)/index.tsx", "utf8");

it("hides the active step from accessibility while submission is modal", () => {
  expect(route).toContain('isSubmitting ? "no-hide-descendants" : "auto"');
  expect(route).toContain("accessibilityElementsHidden={isSubmitting}");
  expect(route).toContain("{isSubmitting && <SubmissionOverlay />}");
});
