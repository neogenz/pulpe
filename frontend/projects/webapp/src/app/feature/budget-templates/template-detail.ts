import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  FinancialSummaryData,
  FinancialSummary,
} from '@ui/financial-summary/financial-summary';

@Component({
  selector: 'pulpe-template-detail',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, FinancialSummary],
  template: `
    <div class="flex flex-col gap-4 h-full">
      <header class="flex items-center gap-4">
        <button
          class="display-none"
          mat-icon-button
          (click)="navigateBack()"
          aria-label="Retour"
        >
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1 class="text-display-small">Détail du modèle</h1>
      </header>

      <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
        <pulpe-financial-summary [data]="incomeData()" />
        <pulpe-financial-summary [data]="expenseData()" />
        <pulpe-financial-summary [data]="savingsData()" />
        <pulpe-financial-summary [data]="negativeData()" />
      </div>

      <div class="flex-1 overflow-auto">
        
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TemplateDetail {
  #router = inject(Router);

  templateId = input.required<string>();

  incomeData = computed<FinancialSummaryData>(() => ({
    title: 'Revenus',
    amount: 0,
    icon: 'trending_up',
    type: 'income',
    isClickable: false,
  }));

  expenseData = computed<FinancialSummaryData>(() => ({
    title: 'Dépenses',
    amount: 0,
    icon: 'trending_down',
    type: 'expense',
  }));

  savingsData = computed<FinancialSummaryData>(() => ({
    title: 'Économies',
    amount: 0,
    icon: 'savings',
    type: 'savings',
  }));

  negativeData = computed<FinancialSummaryData>(() => ({
    title: 'Déficit',
    amount: 0,
    icon: 'money_off',
    type: 'negative',
  }));

  navigateBack() {
    this.#router.navigate(['..']);
  }
}
