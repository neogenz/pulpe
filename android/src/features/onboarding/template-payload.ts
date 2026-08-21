import type { BudgetTemplateCreateFromOnboarding } from "pulpe-shared";

import type { OnboardingState } from "./onboarding-store";
import { toWire } from "./onboarding-transaction";

interface TemplateCopy {
  name: string;
  description: string;
}

/**
 * Turns the answers into the payload the server expects. Kept apart from the
 * request itself so the mapping — which fields exist, which default to zero —
 * can be asserted without an API client, and therefore without the environment
 * that one needs to exist.
 *
 * A charge left empty is sent as zero rather than omitted: the server builds
 * one template line per field above zero, so both say the same thing, and zero
 * says it without relying on a schema default.
 */
export function toTemplatePayload(
  state: OnboardingState,
  copy: TemplateCopy,
): BudgetTemplateCreateFromOnboarding {
  return {
    name: copy.name,
    description: copy.description,
    isDefault: true,
    monthlyIncome: state.monthlyIncome ?? 0,
    housingCosts: state.housingCosts ?? 0,
    healthInsurance: state.healthInsurance ?? 0,
    leasingCredit: state.leasingCredit ?? 0,
    phonePlan: state.phonePlan ?? 0,
    transportCosts: state.transportCosts ?? 0,
    customTransactions: state.customTransactions.map(toWire),
  };
}
