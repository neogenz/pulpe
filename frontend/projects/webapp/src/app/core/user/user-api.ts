import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

interface OnboardingStatusResponse {
  readonly success: boolean;
  readonly onboardingCompleted: boolean;
}

interface OnboardingCompletedResponse {
  readonly success: boolean;
  readonly message: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserApi {
  readonly #http = inject(HttpClient);
  readonly #baseUrl = environment.backendUrl;

  markOnboardingCompleted(): Observable<OnboardingCompletedResponse> {
    return this.#http.put<OnboardingCompletedResponse>(
      `${this.#baseUrl}/user/onboarding-completed`,
      {},
    );
  }

  getOnboardingStatus(): Observable<OnboardingStatusResponse> {
    return this.#http.get<OnboardingStatusResponse>(
      `${this.#baseUrl}/user/onboarding-status`,
    );
  }
}
