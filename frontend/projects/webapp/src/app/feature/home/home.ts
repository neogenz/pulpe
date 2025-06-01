import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'pulpe-home',
  imports: [],
  template: ` <p>home works!</p> `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {}
