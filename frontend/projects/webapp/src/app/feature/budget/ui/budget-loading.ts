import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BaseLoadingComponent } from '../../../ui/loading/base-loading.component';

@Component({
  selector: 'pulpe-months-loading',
  imports: [BaseLoadingComponent],
  template: `
    <pulpe-base-loading
      message="Chargement des données mensuelles..."
      size="large"
      [containerHeight]="256"
      testId="months-loading-container"
    />
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthsLoading {}
