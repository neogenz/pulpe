import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { 
  type BudgetTemplate, 
  type BudgetTemplateCreate,
  type BudgetTemplateListResponse,
  type BudgetTemplateResponse,
  type BudgetTemplateDeleteResponse
} from '@pulpe/shared';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BudgetTemplatesApi {
  #http = inject(HttpClient);
  #apiUrl = `${environment.backendUrl}/budget-templates`;

  getAll$(): Observable<BudgetTemplateListResponse> {
    // Simulation de données en attendant l'API backend
    const mockTemplates: BudgetTemplate[] = [
      {
        id: '1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: null,
        name: 'Budget Étudiant',
        description: 'Template pour un budget étudiant avec revenus limités',
        category: 'Étudiant',
        isDefault: false
      },
      {
        id: '2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: null,
        name: 'Budget Famille',
        description: 'Template pour une famille avec enfants',
        category: 'Famille',
        isDefault: true
      }
    ];

    return of({
      success: true,
      data: mockTemplates
    });
  }

  create$(template: BudgetTemplateCreate): Observable<BudgetTemplateResponse> {
    const newTemplate: BudgetTemplate = {
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: null,
      name: template.name,
      description: template.description ?? null,
      category: template.category ?? null,
      isDefault: template.isDefault
    };

    return of({
      success: true,
      data: newTemplate
    });
  }

  update$(id: string, updates: Partial<BudgetTemplateCreate>): Observable<BudgetTemplateResponse> {
    // Simulation - en réalité ferait un appel HTTP
    return this.#http.patch<BudgetTemplateResponse>(`${this.#apiUrl}/${id}`, updates);
  }

  delete$(id: string): Observable<BudgetTemplateDeleteResponse> {
    // Simulation - en réalité ferait un appel HTTP
    return this.#http.delete<BudgetTemplateDeleteResponse>(`${this.#apiUrl}/${id}`);
  }
}
