import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ForceUpdateGate } from '@pattern/force-update';

@Component({
  selector: 'pulpe-root',
  imports: [RouterOutlet, ForceUpdateGate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <pulpe-force-update-gate />
  `,
})
export class App {}
