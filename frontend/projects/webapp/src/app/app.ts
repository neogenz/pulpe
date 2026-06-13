import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ForceUpdateGate } from '@pattern/force-update';

@Component({
  selector: 'pulpe-root',
  imports: [RouterOutlet, ForceUpdateGate],
  template: `
    <router-outlet />
    <pulpe-force-update-gate />
  `,
})
export class App {}
