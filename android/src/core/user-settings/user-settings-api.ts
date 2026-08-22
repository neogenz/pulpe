import {
  type UpdateUserSettings,
  updateUserSettingsSchema,
  type UserSettings,
  userSettingsResponseSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

export function fetchUserSettings(): Promise<UserSettings> {
  return api
    .get(ENDPOINTS.userSettings, userSettingsResponseSchema)
    .then((response) => response.data);
}

export function updateUserSettings(
  settings: UpdateUserSettings,
): Promise<UserSettings> {
  return api
    .put(
      ENDPOINTS.userSettings,
      settings,
      userSettingsResponseSchema,
      updateUserSettingsSchema,
    )
    .then((response) => response.data);
}
