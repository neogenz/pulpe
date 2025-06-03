import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'pulpe-current-month',
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4">Mois en cours</h1>
      <div class="bg-surface-container rounded-lg p-4">
        <p>Contenu du mois en cours</p>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CurrentMonth {}
