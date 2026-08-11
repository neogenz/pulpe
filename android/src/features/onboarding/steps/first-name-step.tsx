import { TextInput } from "react-native-paper";

import { StepScaffold } from "../components/step-scaffold";
import { canProceed } from "../onboarding-selectors";
import {
  goToNextStep,
  updateAnswers,
  useOnboardingStore,
} from "../onboarding-store";

export function FirstNameStep({ onExit }: { onExit: () => void }) {
  const state = useOnboardingStore();

  return (
    <StepScaffold
      isCtaEnabled={canProceed(state)}
      onContinue={goToNextStep}
      onExit={onExit}
    >
      <TextInput
        mode="outlined"
        label="Prénom"
        placeholder="Ton prénom"
        value={state.firstName}
        onChangeText={(firstName) => updateAnswers({ firstName })}
        autoFocus
        autoCapitalize="words"
        autoComplete="given-name"
        returnKeyType="done"
        accessibilityLabel="Prénom, requis"
      />
    </StepScaffold>
  );
}
