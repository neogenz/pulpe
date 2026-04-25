import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import type { SupportedCurrency, TemplateLine } from 'pulpe-shared';
import { FinancialLineCard } from '@pattern/financial-line-card';

@Component({
  selector: 'pulpe-template-line-card',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    TranslocoPipe,
    FinancialLineCard,
  ],
  template: `
    <pulpe-financial-line-card
      [kind]="line().kind"
      [name]="line().name"
      [amount]="line().amount"
      [currency]="currency()"
      [recurrence]="line().recurrence"
      [dataTestId]="'template-line-' + line().id"
    >
      <div ngProjectAs="[menu]">
        <button
          matIconButton
          [matMenuTriggerFor]="actions"
          [attr.aria-label]="'common.more' | transloco"
          [attr.data-testid]="'template-line-menu-' + line().id"
        >
          <mat-icon>more_horiz</mat-icon>
        </button>
        <mat-menu #actions xPosition="before">
          <button
            mat-menu-item
            (click)="edit.emit(line())"
            [attr.data-testid]="'edit-template-line-' + line().id"
          >
            <mat-icon matMenuItemIcon>edit</mat-icon>
            <span>{{ 'common.edit' | transloco }}</span>
          </button>
          <button
            mat-menu-item
            class="text-error"
            (click)="delete.emit(line().id)"
            [attr.data-testid]="'delete-template-line-' + line().id"
          >
            <mat-icon matMenuItemIcon class="text-error">delete</mat-icon>
            <span>{{ 'common.delete' | transloco }}</span>
          </button>
        </mat-menu>
      </div>
    </pulpe-financial-line-card>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateLineCard {
  readonly line = input.required<TemplateLine>();
  readonly currency = input<SupportedCurrency>('CHF');
  readonly edit = output<TemplateLine>();
  readonly delete = output<string>();
}
