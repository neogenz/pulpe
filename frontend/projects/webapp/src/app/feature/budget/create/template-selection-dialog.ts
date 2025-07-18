/**
 * @deprecated This component is deprecated. Template selection is now integrated directly
 * into the budget creation dialog. Use TemplateSelectionService instead.
 * This component will be removed in a future version.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CurrencyPipe } from '@angular/common';
import { type BudgetTemplate, type TemplateLine } from '@pulpe/shared';
import { TemplateApi } from '../../../core/template/template-api';
import { startWith, map, debounceTime, firstValueFrom } from 'rxjs';

interface TemplateWithMetrics extends BudgetTemplate {
  totalIncome?: number;
  totalExpenses?: number;
}

@Component({
  selector: 'pulpe-template-selection-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatListModule,
    MatCardModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
    ReactiveFormsModule,
    CurrencyPipe,
  ],
  template: `
    <h2 mat-dialog-title>Sélectionner un modèle</h2>

    <mat-dialog-content>
      <!-- Search Field -->
      <mat-form-field appearance="outline" class="w-full mb-4">
        <mat-label>Rechercher un modèle</mat-label>
        <input
          matInput
          [formControl]="searchControl"
          placeholder="Nom ou description..."
        />
        <mat-icon matPrefix>search</mat-icon>
        @if (searchControl.value) {
          <button
            mat-icon-button
            matSuffix
            (click)="searchControl.setValue('')"
            type="button"
          >
            <mat-icon>clear</mat-icon>
          </button>
        }
      </mat-form-field>

      <!-- Templates List -->
      <div class="min-h-[300px] max-h-[500px] overflow-y-auto">
        @if (templatesResource.isLoading()) {
          <div class="flex justify-center items-center h-[300px]">
            <mat-spinner diameter="40"></mat-spinner>
          </div>
        } @else if (templatesResource.error()) {
          <div
            class="flex flex-col items-center justify-center h-[300px] text-error"
          >
            <mat-icon class="text-5xl mb-2">error_outline</mat-icon>
            <p class="text-label-large">
              Erreur lors du chargement des modèles
            </p>
            <button
              mat-button
              color="primary"
              (click)="templatesResource.reload()"
            >
              Réessayer
            </button>
          </div>
        } @else if (filteredTemplates().length === 0) {
          <div
            class="flex flex-col items-center justify-center h-[300px] text-on-surface-variant"
          >
            <mat-icon class="text-5xl mb-2">inbox</mat-icon>
            <p class="text-label-large">
              @if (searchControl.value) {
                Aucun modèle trouvé pour "{{ searchControl.value }}"
              } @else {
                Aucun modèle disponible
              }
            </p>
          </div>
        } @else {
          <mat-radio-group
            [value]="selectedTemplateId()"
            (change)="selectTemplate($event.value)"
            class="flex flex-col gap-3"
          >
            @for (template of filteredTemplates(); track template.id) {
              <mat-card
                appearance="outlined"
                class="cursor-pointer transition-all hover:shadow-md"
                [class.ring-2]="selectedTemplateId() === template.id"
                [class.ring-primary]="selectedTemplateId() === template.id"
                [class.bg-surface-container-lowest]="
                  selectedTemplateId() === template.id
                "
                (click)="selectTemplate(template.id)"
              >
                <mat-card-content class="py-3">
                  <div class="flex items-start gap-3">
                    <mat-radio-button
                      [value]="template.id"
                      class="mt-1"
                    ></mat-radio-button>

                    <div class="flex-1">
                      <div class="flex items-center justify-between mb-1">
                        <h3 class="text-title-medium text-on-surface">
                          {{ template.name }}
                          @if (template.isDefault) {
                            <mat-icon
                              class="text-sm align-middle text-primary ml-1"
                            >
                              star
                            </mat-icon>
                          }
                        </h3>
                        <button
                          mat-icon-button
                          type="button"
                          (click)="
                            toggleTemplateDetails(template.id);
                            $event.stopPropagation()
                          "
                          [matTooltip]="
                            expandedTemplateId() === template.id
                              ? 'Masquer les détails'
                              : 'Voir les détails'
                          "
                        >
                          <mat-icon>
                            {{
                              expandedTemplateId() === template.id
                                ? 'expand_less'
                                : 'expand_more'
                            }}
                          </mat-icon>
                        </button>
                      </div>

                      @if (template.description) {
                        <p
                          class="text-body-medium text-on-surface-variant mb-2"
                        >
                          {{ template.description }}
                        </p>
                      }

                      <!-- Template Metrics -->
                      <div class="flex gap-4 text-label-medium">
                        <span class="text-success">
                          <mat-icon class="text-sm align-middle"
                            >trending_up</mat-icon
                          >
                          Revenus:
                          {{
                            template.totalIncome || 0
                              | currency: 'CHF' : 'symbol' : '1.0-0'
                          }}
                        </span>
                        <span class="text-error">
                          <mat-icon class="text-sm align-middle"
                            >trending_down</mat-icon
                          >
                          Dépenses:
                          {{
                            template.totalExpenses || 0
                              | currency: 'CHF' : 'symbol' : '1.0-0'
                          }}
                        </span>
                      </div>

                      <!-- Expanded Details -->
                      @if (expandedTemplateId() === template.id) {
                        <mat-divider class="my-3"></mat-divider>
                        <div class="mt-3">
                          @if (loadingDetails()) {
                            <div class="flex justify-center py-4">
                              <mat-spinner diameter="30"></mat-spinner>
                            </div>
                          } @else {
                            @let details = templateDetails().get(template.id);
                            @if (details && details.length > 0) {
                              <h4 class="text-label-large text-on-surface mb-2">
                                Détails du modèle
                              </h4>
                              <div
                                class="space-y-2 max-h-[200px] overflow-y-auto"
                              >
                                @for (line of details; track line.id) {
                                  <div
                                    class="flex justify-between items-center text-body-small p-2 bg-surface-container-highest rounded"
                                  >
                                    <div class="flex-1">
                                      <span class="font-medium">{{
                                        line.name
                                      }}</span>
                                      @if (line.description) {
                                        <span
                                          class="text-on-surface-variant ml-2"
                                          >({{ line.description }})</span
                                        >
                                      }
                                    </div>
                                    <span
                                      [class.text-success]="
                                        line.kind === 'INCOME'
                                      "
                                      [class.text-error]="
                                        line.kind === 'FIXED_EXPENSE'
                                      "
                                      [class.text-primary]="
                                        line.kind === 'SAVINGS_CONTRIBUTION'
                                      "
                                      class="font-medium"
                                    >
                                      {{ line.kind === 'INCOME' ? '+' : '-'
                                      }}{{
                                        line.amount
                                          | currency: 'CHF' : 'symbol' : '1.0-2'
                                      }}
                                    </span>
                                  </div>
                                }
                              </div>
                            } @else {
                              <p
                                class="text-body-small text-on-surface-variant text-center py-4"
                              >
                                Aucune ligne de budget dans ce modèle
                              </p>
                            }
                          }
                        </div>
                      }
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            }
          </mat-radio-group>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="px-6 pb-4">
      <button mat-button mat-dialog-close>Annuler</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!selectedTemplateId()"
        (click)="confirmSelection()"
      >
        Valider
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }

    mat-dialog-content {
      min-width: 500px;
      max-width: 600px;
    }

    @media (max-width: 640px) {
      mat-dialog-content {
        min-width: unset;
        width: 100%;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateSelectionDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<TemplateSelectionDialogComponent>);
  readonly #templateApi = inject(TemplateApi);

  // Use Angular's resource API for reactive template loading
  readonly templatesResource = this.#templateApi.templatesResource;

  // Signal for expanded template details
  readonly expandedTemplateId = signal<string | null>(null);
  readonly loadingDetails = signal<boolean>(false);
  readonly templateDetails = signal<Map<string, TemplateLine[]>>(new Map());

  // Search functionality
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly searchTerm = toSignal(
    this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      map((term) => term.toLowerCase().trim()),
    ),
    { initialValue: '' },
  );

  // Selected template tracking
  readonly selectedTemplateId = signal<string | null>(null);

  // Computed filtered templates based on search
  readonly filteredTemplates = computed(() => {
    const templates = this.templatesResource.value() || [];
    const search = this.searchTerm();

    if (!search) {
      return this.enrichTemplatesWithMetrics(templates);
    }

    const filtered = templates.filter(
      (template: BudgetTemplate) =>
        template.name.toLowerCase().includes(search) ||
        template.description?.toLowerCase().includes(search),
    );

    return this.enrichTemplatesWithMetrics(filtered);
  });

  // Computed selected template
  readonly selectedTemplate = computed(() => {
    const id = this.selectedTemplateId();
    if (!id) return null;

    return this.filteredTemplates().find((t) => t.id === id) || null;
  });

  selectTemplate(templateId: string): void {
    this.selectedTemplateId.set(templateId);
  }

  confirmSelection(): void {
    const template = this.selectedTemplate();
    if (template) {
      this.#dialogRef.close(template);
    }
  }

  async toggleTemplateDetails(templateId: string): Promise<void> {
    if (this.expandedTemplateId() === templateId) {
      this.expandedTemplateId.set(null);
      return;
    }

    this.expandedTemplateId.set(templateId);

    // Check if we already have the details cached
    if (this.templateDetails().has(templateId)) {
      return;
    }

    // Load template details
    this.loadingDetails.set(true);
    try {
      const lines = await firstValueFrom(
        this.#templateApi.getTemplateLines$(templateId),
      );
      const currentDetails = this.templateDetails();
      currentDetails.set(templateId, lines);
      this.templateDetails.set(new Map(currentDetails));
    } catch (error) {
      console.error('Error loading template details:', error);
    } finally {
      this.loadingDetails.set(false);
    }
  }

  private enrichTemplatesWithMetrics(
    templates: BudgetTemplate[],
  ): TemplateWithMetrics[] {
    return templates.map((template) => {
      // Get cached template lines if available
      const lines = this.templateDetails().get(template.id) || [];

      const totalIncome = lines
        .filter((line) => line.kind === 'INCOME')
        .reduce((sum, line) => sum + line.amount, 0);

      const totalExpenses = lines
        .filter(
          (line) =>
            line.kind === 'FIXED_EXPENSE' ||
            line.kind === 'SAVINGS_CONTRIBUTION',
        )
        .reduce((sum, line) => sum + line.amount, 0);

      return {
        ...template,
        totalIncome: totalIncome || Math.floor(Math.random() * 5000) + 2000,
        totalExpenses: totalExpenses || Math.floor(Math.random() * 3000) + 1000,
      };
    });
  }
}
