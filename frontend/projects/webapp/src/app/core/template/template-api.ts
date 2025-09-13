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
import { DemoModeService } from '../demo/demo-mode.service';
import { DemoStorageAdapter } from '../demo/demo-storage-adapter';

@Injectable({
  providedIn: 'root',
})
export class TemplateApi {
  #http = inject(HttpClient);
  #applicationConfig = inject(ApplicationConfiguration);
  #demoMode = inject(DemoModeService);
  #demoStorage = inject(DemoStorageAdapter);

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budget-templates`;
  }

  /**
   * Observable that fetches all templates for the current user
   */
  getAll$(): Observable<BudgetTemplate[]> {
    // Si en mode démo, utiliser le DemoStorageAdapter
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage
        .getAllTemplates$()
        .pipe(map((response) => response.data || []));
    }

    return this.#http
      .get<BudgetTemplateListResponse>(this.#apiUrl)
      .pipe(map((response) => response.data || []));
  }

  /**
   * Fetches a specific template by ID
   */
  getById$(id: string): Observable<BudgetTemplate> {
    // Si en mode démo, utiliser le DemoStorageAdapter
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage
        .getTemplateById$(id)
        .pipe(map((response) => response.data));
    }

    return this.#http
      .get<BudgetTemplateResponse>(`${this.#apiUrl}/${id}`)
      .pipe(map((response) => response.data));
  }

  /**
   * Fetches template lines (transactions) for a specific template
   */
  getTemplateLines$(templateId: string): Observable<TemplateLine[]> {
    // Si en mode démo, utiliser le DemoStorageAdapter
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage
        .getTemplateLines$(templateId)
        .pipe(map((response) => response.data || []));
    }

    return this.#http
      .get<TemplateLineListResponse>(`${this.#apiUrl}/${templateId}/lines`)
      .pipe(map((response) => response.data || []));
  }
}
