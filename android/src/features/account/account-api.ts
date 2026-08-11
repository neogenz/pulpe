import {
  type DeleteAccountResponse,
  deleteAccountResponseSchema,
  type UpdateProfile,
  updateProfileSchema,
  type UserProfile,
  userProfileResponseSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

export function fetchUserProfile(): Promise<UserProfile> {
  return api
    .get(ENDPOINTS.userProfile, userProfileResponseSchema)
    .then((response) => response.user);
}

export function updateUserProfile(
  changes: UpdateProfile,
): Promise<UserProfile> {
  return api
    .put<
      { user: UserProfile },
      UpdateProfile
    >(ENDPOINTS.userProfileUpdate, changes, userProfileResponseSchema, updateProfileSchema)
    .then((response) => response.user);
}

/**
 * Schedules the account for deletion rather than performing it: the response
 * carries the date it becomes irreversible, which is what the confirmation
 * has to state.
 */
export function deleteAccount(): Promise<DeleteAccountResponse> {
  return api.delete(ENDPOINTS.userAccount, deleteAccountResponseSchema);
}
