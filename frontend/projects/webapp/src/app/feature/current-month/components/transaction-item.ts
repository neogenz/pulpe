import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'pulpe-transaction-item',
  imports: [],
  template: `
    <p>
      transaction-item works!
    </p>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionItem {

}
