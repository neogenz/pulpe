import { useEffect } from "react";

import { useUserSettings } from "@/core/user-settings/user-settings-queries";

import { applyServerLocale } from "./locale-store";

export function LocaleSync() {
  const settings = useUserSettings();

  useEffect(() => {
    if (settings.isSuccess) applyServerLocale(settings.data.locale);
  }, [settings.data?.locale, settings.isSuccess]);

  return null;
}
