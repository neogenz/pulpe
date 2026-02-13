import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  type BudgetTemplate,
  budgetTemplateListResponseSchema,
  budgetTemplateResponseSchema,
  type TemplateLine,
  templateLineListResponseSchema,
} from 'pulpe-shared';
import { ApiClient } from '@core/api/api-client';

@Injectable({
  providedIn: 'root',
})
export class TemplateApi {
  readonly #api = inject(ApiClient);

  getAll$(): Observable<BudgetTemplate[]> {
    return this.#api
      .get$('/budget-templates', budgetTemplateListResponseSchema)
      .pipe(map((response) => response.data));
  }

  getById$(id: string): Observable<BudgetTemplate> {
    return this.#api
      .get$(`/budget-templates/${id}`, budgetTemplateResponseSchema)
      .pipe(map((response) => response.data));
  }

  getTemplateLines$(templateId: string): Observable<TemplateLine[]> {
    return this.#api
      .get$(
        `/budget-templates/${templateId}/lines`,
        templateLineListResponseSchema,
      )
      .pipe(map((response) => response.data));
  }
}
