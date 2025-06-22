import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BudgetTemplatesState } from './services/budget-templates-state';

@Component({
  selector: 'pulpe-template-detail',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="flex flex-col gap-4 h-full">
      <header class="flex items-center gap-4">
        <button mat-icon-button (click)="navigateBack()" aria-label="Retour">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1 class="text-display-small">Détail du modèle</h1>
      </header>

      <div class="flex-1 overflow-auto">
        <div class="text-center py-8 text-on-surface-variant">
          <mat-icon class="text-6xl mb-4">description</mat-icon>
          <p class="text-body-large">Détail du modèle</p>
          <p class="text-body-medium">Template ID: {{ templateId() }}</p>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      padding: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TemplateDetail {
  #router = inject(Router);
  #state = inject(BudgetTemplatesState);

  templateId = input.required<string>();

  navigateBack() {
    this.#router.navigate(['/budget-templates']);
  }
}
