import { useEffect } from "react";

import { useUserSettings } from "@/core/user-settings/user-settings-queries";

import { applyServerLocale, useLocaleStore } from "./locale-store";
import { languageWriter } from "./language-writer";

export function LocaleSync() {
  const settings = useUserSettings();
  const isWritePending = useLocaleStore((state) => state.isWritePending);

  useEffect(() => {
    if (settings.isSuccess && !isWritePending) {
      if (settings.data.locale)
        languageWriter.synchronize(settings.data.locale);
      applyServerLocale(settings.data.locale);
    }
  }, [isWritePending, settings.data?.locale, settings.isSuccess]);

  return null;
}
