import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'pulpe-variable-expenses-list',
  imports: [],
  template: `
    <p>
      variable-expenses-list works!
    </p>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VariableExpensesList {

}
