import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  type BudgetTemplate,
  budgetTemplateListResponseSchema,
  budgetTemplateResponseSchema,
  type TemplateLine,
  templateLineListResponseSchema,
} from '@pulpe/shared';
import { ApplicationConfiguration } from '../config/application-configuration';

@Injectable({
  providedIn: 'root',
})
export class TemplateApi {
  readonly #http = inject(HttpClient);
  readonly #applicationConfig = inject(ApplicationConfiguration);

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budget-templates`;
  }

  getAll$(): Observable<BudgetTemplate[]> {
    return this.#http
      .get<unknown>(this.#apiUrl)
      .pipe(
        map(
          (response) => budgetTemplateListResponseSchema.parse(response).data,
        ),
      );
  }

  getById$(id: string): Observable<BudgetTemplate> {
    return this.#http
      .get<unknown>(`${this.#apiUrl}/${id}`)
      .pipe(
        map((response) => budgetTemplateResponseSchema.parse(response).data),
      );
  }

  getTemplateLines$(templateId: string): Observable<TemplateLine[]> {
    return this.#http
      .get<unknown>(`${this.#apiUrl}/${templateId}/lines`)
      .pipe(
        map((response) => templateLineListResponseSchema.parse(response).data),
      );
  }
}
