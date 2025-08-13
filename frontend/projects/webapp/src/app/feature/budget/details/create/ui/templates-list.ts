import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { startWith, debounceTime, map } from 'rxjs';
import { type BudgetTemplate } from '@pulpe/shared';
import { TemplateListItem } from './template-list-item';

/**
 * ViewModel interface for template display in the UI component.
 * Simplified structure focused on presentation needs.
 */
export interface TemplateViewModel {
  /** Original template data */
  template: BudgetTemplate;
  /** Total monthly income from template */
  totalIncome: number;
  /** Total monthly expenses + savings from template */
  totalExpenses: number;
  /** Remaining living allowance after expenses and savings */
  remainingLivingAllowance: number;
  /** Whether financial data is currently being loaded */
  loading: boolean;
}

@Component({
  selector: 'pulpe-templates-list',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    TemplateListItem,
  ],
  template: `
    <!-- Search Field -->
    <mat-form-field appearance="outline" class="w-full mb-2 md:mb-4">
      <mat-label>Rechercher un modèle</mat-label>
      <input
        matInput
        [formControl]="searchControl"
        placeholder="Nom ou description..."
      />
      <mat-icon matPrefix>search</mat-icon>
      @if (searchControl.value) {
        <button matIconButton matSuffix (click)="searchControl.setValue('')">
          <mat-icon>clear</mat-icon>
        </button>
      }
    </mat-form-field>

    <!-- Templates List -->
    <div class="template-list">
      @if (isLoading()) {
        <div class="flex justify-center items-center h-[200px]">
          <mat-progress-spinner
            mode="indeterminate"
            aria-label="Chargement des modèles"
            role="progressbar"
            class="pulpe-loading-indicator pulpe-loading-medium"
          ></mat-progress-spinner>
        </div>
      } @else if (hasError()) {
        <div
          class="flex flex-col items-center justify-center h-[200px] text-error"
        >
          <mat-icon class="text-display-small mb-2">error_outline</mat-icon>
          <p class="text-label-large">Erreur lors du chargement des modèles</p>
          <button matButton color="primary" (click)="retryRequested.emit()">
            Réessayer
          </button>
        </div>
      } @else if (filteredTemplates().length === 0) {
        <div
          class="flex flex-col items-center justify-center h-[200px] text-on-surface-variant"
        >
          <mat-icon class="text-display-small mb-2">inbox</mat-icon>
          <p class="text-label-large">
            @if (searchTerm()) {
              Aucun modèle trouvé pour "{{ searchTerm() }}"
            } @else {
              Aucun modèle disponible
            }
          </p>
        </div>
      } @else {
        <mat-radio-group
          [value]="selectedTemplateId()"
          (change)="onTemplateSelect($event.value)"
          class="flex flex-col gap-2 md:gap-3"
          data-testid="template-selection-radio-group"
        >
          @for (
            templateViewModel of filteredTemplates();
            track templateViewModel.template.id
          ) {
            <pulpe-template-list-item
              [templateViewModel]="templateViewModel"
              [isSelected]="
                selectedTemplateId() === templateViewModel.template.id
              "
              (selectTemplate)="onTemplateSelect($event)"
              (showDetails)="onShowDetails(templateViewModel)"
              [attr.data-testid]="
                'template-card-' + templateViewModel.template.id
              "
            />
          }
        </mat-radio-group>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .template-list {
      min-height: 250px;
      max-height: 350px;
      overflow-y: auto;
      padding: 0.375rem;
      border: 1px solid var(--mat-form-field-outline-color);
      border-radius: 4px;
      background-color: var(--mat-app-surface);
    }

    @media (max-width: 640px) {
      .template-list {
        min-height: 200px;
        max-height: 300px;
        padding: 0.25rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatesList {
  // Inputs
  templates = input<TemplateViewModel[]>([]);
  selectedTemplateId = input<string | null>(null);
  isLoading = input<boolean>(false);
  hasError = input<boolean>(false);

  // Outputs
  templateSelected = output<string>();
  templateDetailsRequested = output<TemplateViewModel>();
  retryRequested = output<void>();

  // Local search state
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly searchTerm = toSignal(
    this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      map((term) => term.toLowerCase().trim()),
    ),
    { initialValue: '' },
  );

  // Filtered templates based on search
  readonly filteredTemplates = computed(() => {
    const allTemplates = this.templates();
    const search = this.searchTerm();

    if (!search) {
      return allTemplates;
    }

    return allTemplates.filter((templateViewModel) => {
      const template = templateViewModel.template;
      return (
        template.name.toLowerCase().includes(search) ||
        template.description?.toLowerCase().includes(search)
      );
    });
  });

  onTemplateSelect(templateId: string): void {
    this.templateSelected.emit(templateId);
  }

  onShowDetails(templateViewModel: TemplateViewModel): void {
    this.templateDetailsRequested.emit(templateViewModel);
  }
}
