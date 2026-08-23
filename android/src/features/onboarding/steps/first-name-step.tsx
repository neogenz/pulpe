import { TextInput } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";

import { StepScaffold } from "../components/step-scaffold";
import { canProceed } from "../onboarding-selectors";
import {
  goToNextStep,
  updateAnswers,
  useOnboardingStore,
} from "../onboarding-store";

export function FirstNameStep({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation();
  const state = useOnboardingStore();

  return (
    <StepScaffold
      isCtaEnabled={canProceed(state)}
      title={t("onboarding.firstName.title")}
      subtitle={t("onboarding.firstName.subtitle")}
      onContinue={goToNextStep}
      onExit={onExit}
    >
      <TextInput
        mode="outlined"
        label={t("onboarding.firstName.label")}
        placeholder={t("onboarding.firstName.placeholder")}
        value={state.firstName}
        onChangeText={(firstName) => updateAnswers({ firstName })}
        autoFocus
        autoCapitalize="words"
        autoComplete="given-name"
        returnKeyType="done"
        accessibilityLabel={t("onboarding.firstName.accessibility")}
      />
    </StepScaffold>
  );
}
