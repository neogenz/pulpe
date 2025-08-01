import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BaseLoadingComponent } from '../../../ui/loading/base-loading.component';

@Component({
  selector: 'pulpe-templates-loading',
  imports: [BaseLoadingComponent],
  template: `
    <pulpe-base-loading
      message="Chargement des modèles de budget..."
      size="large"
      [containerHeight]="256"
      testId="templates-loading-container"
    />
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatesLoading {}
