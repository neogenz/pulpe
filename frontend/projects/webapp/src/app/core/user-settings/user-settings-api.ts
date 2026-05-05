import { inject, Injectable } from '@angular/core';
import { DataCache } from 'ngx-ziflux';
import {
  type UserSettingsResponse,
  type UpdateUserSettings,
  updateUserSettingsSchema,
  type DeleteAccountResponse,
  userSettingsResponseSchema,
  deleteAccountResponseSchema,
} from 'pulpe-shared';
import { type Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '@core/api/api-client';

@Injectable({
  providedIn: 'root',
})
export class UserSettingsApi {
  readonly #api = inject(ApiClient);

  readonly cache = new DataCache({
    name: 'settings',
    staleTime: 60_000,
    expireTime: 600_000,
  });

  getSettings$(): Observable<UserSettingsResponse> {
    return this.#api.get$('/users/settings', userSettingsResponseSchema);
  }

  updateSettings$(
    settings: UpdateUserSettings,
  ): Observable<UserSettingsResponse> {
    return this.#api.put$(
      '/users/settings',
      settings,
      userSettingsResponseSchema,
      updateUserSettingsSchema,
    );
  }

  deleteAccount(): Promise<DeleteAccountResponse> {
    return firstValueFrom(
      this.#api.delete$('/users/account', deleteAccountResponseSchema),
    );
  }
}
