import { inject, Injectable, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  type BudgetTemplateCreateFromOnboarding,
  type BudgetTemplateCreateResponse,
  type BudgetTemplateListResponse,
  type BudgetTemplateResponse,
  type BudgetTemplate,
  type TemplateLineListResponse,
  type TemplateLine,
} from '@pulpe/shared';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TemplateApi {
  #http = inject(HttpClient);
  #apiUrl = `${environment.backendUrl}/budget-templates`;

  /**
   * Resource that fetches all templates for the current user
   * Uses Angular's resource API for reactive data management
   */
  readonly templatesResource = resource({
    loader: async () => {
      const response = await firstValueFrom(
        this.#http.get<BudgetTemplateListResponse>(this.#apiUrl),
      );
      return response.data || [];
    },
  });

  /**
   * Observable that fetches all templates for the current user
   * Alternative to resource for traditional observable approach
   */
  getAll$(): Observable<BudgetTemplate[]> {
    return this.#http
      .get<BudgetTemplateListResponse>(this.#apiUrl)
      .pipe(map((response) => response.data || []));
  }

  /**
   * Fetches a specific template by ID
   */
  getById$(id: string): Observable<BudgetTemplate> {
    return this.#http
      .get<BudgetTemplateResponse>(`${this.#apiUrl}/${id}`)
      .pipe(map((response) => response.data));
  }

  /**
   * Fetches template lines (transactions) for a specific template
   */
  getTemplateLines$(templateId: string): Observable<TemplateLine[]> {
    return this.#http
      .get<TemplateLineListResponse>(`${this.#apiUrl}/${templateId}/lines`)
      .pipe(map((response) => response.data || []));
  }

  createFromOnboarding$(
    onboardingData: BudgetTemplateCreateFromOnboarding,
  ): Observable<BudgetTemplateCreateResponse> {
    return this.#http.post<BudgetTemplateCreateResponse>(
      `${this.#apiUrl}/from-onboarding`,
      onboardingData,
    );
  }
}
