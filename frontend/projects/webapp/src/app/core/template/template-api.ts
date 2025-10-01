import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  type BudgetTemplateListResponse,
  type BudgetTemplateResponse,
  type BudgetTemplate,
  type TemplateLineListResponse,
  type TemplateLine,
} from '@pulpe/shared';
import { ApplicationConfiguration } from '../config/application-configuration';

@Injectable({
  providedIn: 'root',
})
export class TemplateApi {
  #http = inject(HttpClient);
  #applicationConfig = inject(ApplicationConfiguration);

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budget-templates`;
  }

  /**
   * Observable that fetches all templates for the current user
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
}
