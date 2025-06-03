import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'pulpe-other-months',
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4">Autres mois</h1>
      <div class="bg-surface-container rounded-lg p-4">
        <p>Liste des autres mois</p>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class OtherMonths {}
