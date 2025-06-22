import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'pulpe-templates-loading',
  imports: [MatProgressSpinnerModule, MatCardModule],
  template: `
    <mat-card class="flex flex-col items-center justify-center p-8">
      <mat-spinner diameter="48"></mat-spinner>
      <p class="text-body-large mt-4">Chargement des modèles...</p>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplatesLoading {

}
