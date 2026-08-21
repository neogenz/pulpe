import { useEffect } from "react";

import { useUserSettings } from "@/core/user-settings/user-settings-queries";

import { applyServerLocale, useLocaleStore } from "./locale-store";

export function LocaleSync() {
  const settings = useUserSettings();
  const isWritePending = useLocaleStore((state) => state.isWritePending);

  useEffect(() => {
    if (settings.isSuccess && !isWritePending) {
      applyServerLocale(settings.data.locale);
    }
  }, [isWritePending, settings.data?.locale, settings.isSuccess]);

  return null;
}
