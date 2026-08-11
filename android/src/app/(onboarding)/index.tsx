import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { Alert, BackHandler } from "react-native";

import { SubmissionOverlay } from "@/features/onboarding/components/submission-overlay";
import { wouldExitOnBack } from "@/features/onboarding/onboarding-selectors";
import {
  goToPreviousStep,
  resetOnboarding,
  useOnboardingStore,
} from "@/features/onboarding/onboarding-store";
import type { OnboardingStep } from "@/features/onboarding/onboarding-step";
import { useSubmissionStore } from "@/features/onboarding/onboarding-submission";
import { BudgetPreviewStep } from "@/features/onboarding/steps/budget-preview-step";
import { ChargesStep } from "@/features/onboarding/steps/charges-step";
import { FirstNameStep } from "@/features/onboarding/steps/first-name-step";
import { IncomeStep } from "@/features/onboarding/steps/income-step";
import { PinSetupStep } from "@/features/onboarding/steps/pin-setup-step";
import { RegistrationStep } from "@/features/onboarding/steps/registration-step";
import { SavingsStep } from "@/features/onboarding/steps/savings-step";
import { WelcomeStep } from "@/features/onboarding/steps/welcome-step";

/**
 * The whole flow on one route.
 *
 * Seven routes would put the step in two places at once — the router and
 * `currentStep` — and the two drift the moment the hardware back button moves
 * one without the other. One route also makes "no swipe back" a property of the
 * screen rather than a navigator option that has to hold on every step.
 */
export default function OnboardingRoute() {
  const router = useRouter();
  const currentStep = useOnboardingStore((state) => state.currentStep);
  const isSubmitting = useSubmissionStore((state) => state.status !== "idle");

  const confirmExit = useCallback(() => {
    Alert.alert(
      "Quitter la création de ton budget ?",
      "Ce que tu as saisi sera effacé.",
      [
        { text: "Continuer", style: "cancel" },
        {
          text: "Quitter",
          style: "destructive",
          onPress: () => {
            resetOnboarding();
            router.replace("/sign-in");
          },
        },
      ],
    );
  }, [router]);

  // The hardware back button has to answer the same way the on-screen one
  // does; left to itself it would pop the flow off the stack mid-step.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        // The creation is under way and cannot be half-undone; the overlay's
        // own buttons are the way out of it.
        if (useSubmissionStore.getState().status !== "idle") return true;

        const state = useOnboardingStore.getState();
        if (state.currentStep === "welcome") return false;
        if (state.editReturnStep === null && wouldExitOnBack(state)) {
          confirmExit();
          return true;
        }
        goToPreviousStep();
        return true;
      },
    );
    return () => subscription.remove();
  }, [confirmExit]);

  return (
    <>
      <CurrentStep step={currentStep} onExit={confirmExit} />
      {isSubmitting && <SubmissionOverlay />}
    </>
  );
}

function CurrentStep({
  step,
  onExit,
}: {
  step: OnboardingStep;
  onExit: () => void;
}) {
  switch (step) {
    case "welcome":
      return <WelcomeStep />;
    case "firstName":
      return <FirstNameStep onExit={onExit} />;
    case "registration":
      return <RegistrationStep onExit={onExit} />;
    case "income":
      return <IncomeStep onExit={onExit} />;
    case "charges":
      return <ChargesStep onExit={onExit} />;
    case "savings":
      return <SavingsStep onExit={onExit} />;
    case "budgetPreview":
      return <BudgetPreviewStep onExit={onExit} />;
    case "pinSetup":
      return <PinSetupStep />;
  }
}
