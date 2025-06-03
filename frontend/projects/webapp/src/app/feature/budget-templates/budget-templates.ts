import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'pulpe-budget-templates',
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4">Modèles de budget</h1>
      <div class="bg-surface-container rounded-lg p-4">
        <p>Gestion des modèles de budget</p>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class BudgetTemplates {}
