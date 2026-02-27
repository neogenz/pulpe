import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppVersionLabel } from '@ui/app-version-label';

@Component({
  selector: 'pulpe-auth-layout',
  imports: [RouterOutlet, AppVersionLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pulpe-entry-shell pulpe-gradient">
      <router-outlet />
      <pulpe-app-version-label />
    </div>
  `,
})
export default class AuthLayout {}
