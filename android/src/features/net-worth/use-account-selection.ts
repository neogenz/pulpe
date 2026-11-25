import { FEATURE_FLAGS } from "pulpe-shared";
import { useState } from "react";

import { useFeatureFlag } from "@/core/observability/feature-flags";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";

import {
  accountChange,
  accountChoices,
  isAccountOffered,
  startAccount,
} from "./account-link";
import { useNetWorth } from "./net-worth-queries";

/**
 * What « Compte » may be set to, `current` included even archived, and the
 * default as long as it is still active.
 */
export function useAccountChoices(current: string | null = null) {
  const isFlagOn = useFeatureFlag(FEATURE_FLAGS.NET_WORTH);
  const netWorth = useNetWorth(isFlagOn);
  const settings = useUserSettings();
  const assets = netWorth.data?.assets ?? [];
  const active = accountChoices(assets);
  return {
    choices: accountChoices(assets, current),
    isOffered: isAccountOffered(isFlagOn, active),
    // An archived or deleted element reads as « Aucun »: the server clears it too.
    defaultId: startAccount(settings.data?.defaultAccountId ?? null, active),
  };
}

/**
 * The « Compte » of a form. A creation starts on the default account; an edit
 * on the account it already has. `change` is what a PATCH carries (CA26) and
 * `create` what a creation sends: always stated, `null` for « Aucun », so the
 * server's default never overrides a choice (CA3).
 */
export function useAccountSelection(
  initial: string | null,
  isCreating: boolean,
) {
  const { choices, isOffered, defaultId } = useAccountChoices(
    isCreating ? null : initial,
  );
  // `undefined` is untouched: the field then shows its start value.
  const [picked, setPicked] = useState<string | null | undefined>(undefined);

  const start = isCreating ? defaultId : initial;
  const account = !isOffered ? null : picked === undefined ? start : picked;

  return {
    choices,
    isOffered,
    account,
    setAccount: setPicked,
    reset: () => setPicked(undefined),
    create: { accountId: account },
    change: isOffered ? accountChange(initial, account) : {},
  };
}
