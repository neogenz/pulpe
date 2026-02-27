import { ChangeDetectionStrategy, Component } from '@angular/core';
import { buildInfo } from '@env/build-info';

@Component({
  selector: 'pulpe-app-version-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block py-3 text-label-small text-on-surface-variant/50',
  },
  template: `v{{ version }}`,
})
export class AppVersionLabel {
  protected readonly version = buildInfo.version;
}
