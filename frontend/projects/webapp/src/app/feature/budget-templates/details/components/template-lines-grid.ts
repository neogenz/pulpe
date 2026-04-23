import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import type {
  SupportedCurrency,
  TemplateLine,
  TransactionKind,
} from 'pulpe-shared';
import { FinancialKindDirective } from '@ui/financial-kind';
import { StateCard } from '@ui/state-card/state-card';
import { TemplateLineCard } from './template-line-card';

interface TemplateLineGroup {
  kind: TransactionKind;
  icon: string;
  labelKey: string;
  lines: TemplateLine[];
}

@Component({
  selector: 'pulpe-template-lines-grid',
  imports: [
    MatIconModule,
    TranslocoPipe,
    TemplateLineCard,
    StateCard,
    FinancialKindDirective,
  ],
  template: `
    @if (lines().length === 0) {
      <pulpe-state-card
        variant="empty"
        [title]="'template.noLines' | transloco"
        [message]="'template.noLinesCta' | transloco"
        [actionLabel]="'template.addLine' | transloco"
        testId="template-lines-empty"
        (action)="add.emit()"
      />
    } @else {
      <div class="flex flex-col gap-8">
        @for (group of groupedLines(); track group.kind) {
          <section
            class="flex flex-col gap-3"
            [attr.data-testid]="'template-lines-group-' + group.kind"
          >
            <header class="flex items-center gap-2 text-title-medium">
              <mat-icon [pulpeFinancialKind]="group.kind">
                {{ group.icon }}
              </mat-icon>
              <span class="font-medium">{{ group.labelKey | transloco }}</span>
              <span
                class="text-label-medium text-on-surface-variant ml-1"
                [attr.data-testid]="'template-lines-group-count-' + group.kind"
              >
                ({{ group.lines.length }})
              </span>
            </header>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              @for (line of group.lines; track line.id) {
                <pulpe-template-line-card
                  [line]="line"
                  [currency]="currency()"
                  (edit)="edit.emit($event)"
                  (delete)="delete.emit($event)"
                />
              }
            </div>
          </section>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateLinesGrid {
  readonly lines = input.required<readonly TemplateLine[]>();
  readonly currency = input<SupportedCurrency>('CHF');
  readonly edit = output<TemplateLine>();
  readonly delete = output<string>();
  readonly add = output<void>();

  protected readonly groupedLines = computed<TemplateLineGroup[]>(() => {
    const lines = this.lines();
    const groups: TemplateLineGroup[] = [
      {
        kind: 'income',
        icon: 'trending_up',
        labelKey: 'template.incomeGroupLabel',
        lines: lines.filter((line) => line.kind === 'income'),
      },
      {
        kind: 'saving',
        icon: 'savings',
        labelKey: 'template.savingsGroupLabel',
        lines: lines.filter((line) => line.kind === 'saving'),
      },
      {
        kind: 'expense',
        icon: 'trending_down',
        labelKey: 'template.expensesGroupLabel',
        lines: lines.filter((line) => line.kind === 'expense'),
      },
    ];
    return groups.filter((group) => group.lines.length > 0);
  });
}
