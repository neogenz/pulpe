import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { Alert, BackHandler } from "react-native";

import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { wouldExitOnBack } from "@/features/onboarding/onboarding-selectors";
import {
  goToPreviousStep,
  resetOnboarding,
  useOnboardingStore,
} from "@/features/onboarding/onboarding-store";
import { ChargesStep } from "@/features/onboarding/steps/charges-step";
import { FirstNameStep } from "@/features/onboarding/steps/first-name-step";
import { IncomeStep } from "@/features/onboarding/steps/income-step";
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

  switch (currentStep) {
    case "welcome":
      return <WelcomeStep />;
    case "firstName":
      return <FirstNameStep onExit={confirmExit} />;
    case "registration":
      return <RegistrationStep onExit={confirmExit} />;
    case "income":
      return <IncomeStep onExit={confirmExit} />;
    case "charges":
      return <ChargesStep onExit={confirmExit} />;
    case "savings":
      return <SavingsStep onExit={confirmExit} />;
    case "budgetPreview":
      return (
        <PlaceholderScreen
          title="Bientôt disponible"
          hint="L'aperçu de ton budget arrive."
        />
      );
  }
}
