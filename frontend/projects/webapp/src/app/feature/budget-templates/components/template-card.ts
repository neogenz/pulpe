import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { type BudgetTemplate, type SupportedCurrency } from 'pulpe-shared';

export interface TemplateSummary {
  income: number;
  expense: number;
  savings: number;
  netBalance: number;
}

const LEADING_EMOJI_REGEX =
  /^\s*(\p{Extended_Pictographic}(‍\p{Extended_Pictographic})*️?)\s*/u;

@Component({
  selector: 'pulpe-template-card',
  imports: [
    RouterLink,
    MatCardModule,
    MatIconModule,
    TranslocoPipe,
    DecimalPipe,
  ],
  template: `
    <mat-card
      appearance="outlined"
      class="template-card cursor-pointer"
      [routerLink]="['details', template().id]"
      [attr.data-testid]="'template-' + template().name"
    >
      <mat-card-header>
        <div mat-card-avatar class="template-card__avatar">
          @if (emoji(); as leadingEmoji) {
            <span
              class="flex justify-center items-center size-11 text-2xl"
              aria-hidden="true"
              >{{ leadingEmoji }}</span
            >
          } @else {
            <div
              class="flex justify-center items-center size-11 bg-secondary-container rounded-full"
            >
              <mat-icon>description</mat-icon>
            </div>
          }
        </div>
        <mat-card-title class="ph-no-capture">{{
          displayName()
        }}</mat-card-title>
        @if (template().isDefault) {
          <mat-card-subtitle>{{
            'template.isDefault' | transloco
          }}</mat-card-subtitle>
        } @else {
          <mat-card-subtitle>{{
            'template.defaultLabel' | transloco
          }}</mat-card-subtitle>
        }
      </mat-card-header>
      <mat-card-content class="p-4!">
        @if (template().description) {
          <p
            class="text-body-medium text-on-surface-variant template-card__description ph-no-capture"
          >
            {{ template().description }}
          </p>
        }
        @if (summary(); as totals) {
          <div
            class="flex flex-wrap gap-2 mt-3"
            role="list"
            [attr.aria-label]="'template.financialSummary' | transloco"
          >
            <div
              role="listitem"
              class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-financial-income-light"
            >
              <mat-icon class="text-financial-income mat-icon-sm"
                >trending_up</mat-icon
              >
              <span
                class="text-label-small font-semibold text-financial-income ph-no-capture"
              >
                {{ totals.income | number: '1.0-0' : 'de-CH' }}
                {{ currency() }}
              </span>
            </div>
            <div
              role="listitem"
              class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-financial-expense-light"
            >
              <mat-icon class="text-financial-expense mat-icon-sm"
                >trending_down</mat-icon
              >
              <span
                class="text-label-small font-semibold text-financial-expense ph-no-capture"
              >
                {{ totals.expense | number: '1.0-0' : 'de-CH' }}
                {{ currency() }}
              </span>
            </div>
            <div
              role="listitem"
              class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-financial-savings-light"
            >
              <mat-icon class="text-financial-savings mat-icon-sm"
                >savings</mat-icon
              >
              <span
                class="text-label-small font-semibold text-financial-savings ph-no-capture"
              >
                {{ totals.savings | number: '1.0-0' : 'de-CH' }}
                {{ currency() }}
              </span>
            </div>
          </div>
        }
      </mat-card-content>
      @if (summary(); as totals) {
        <mat-card-footer class="template-card__footer">
          <span class="text-label-medium text-on-surface-variant">{{
            'template.summaryNet' | transloco
          }}</span>
          <span
            class="text-label-large font-semibold ph-no-capture"
            [class.text-financial-savings]="totals.netBalance >= 0"
            [class.text-financial-expense]="totals.netBalance < 0"
          >
            {{ totals.netBalance | number: '1.0-0' : 'de-CH' }}
            {{ currency() }}
          </span>
        </mat-card-footer>
      }
      <mat-icon aria-hidden="true" class="template-card__chevron mat-icon-sm"
        >chevron_right</mat-icon
      >
    </mat-card>
  `,
  styles: `
    @use '@angular/material' as mat;

    :host {
      display: block;

      mat-card:hover {
        box-shadow: var(--mat-sys-level1);
      }

      .template-card__chevron {
        position: absolute;
        top: 50%;
        right: 0.5rem;
        transform: translateY(-50%);
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.5;
        pointer-events: none;
        transition:
          opacity var(--pulpe-motion-base) var(--pulpe-ease-standard),
          color var(--pulpe-motion-base) var(--pulpe-ease-standard),
          transform var(--pulpe-motion-base) var(--pulpe-ease-standard);
      }

      .template-card:hover .template-card__chevron,
      .template-card:focus-visible .template-card__chevron {
        opacity: 1;
        color: var(--mat-sys-primary);
        transform: translateY(-50%) translateX(3px);
      }

      @media (prefers-reduced-motion: reduce) {
        .template-card__chevron,
        .template-card:hover .template-card__chevron,
        .template-card:focus-visible .template-card__chevron {
          transition:
            opacity var(--pulpe-motion-base) var(--pulpe-ease-standard),
            color var(--pulpe-motion-base) var(--pulpe-ease-standard);
          transform: translateY(-50%);
        }
      }

      @include mat.card-overrides(
        (
          title-text-size: var(--mat-sys-title-medium-size),
          title-text-weight: var(--mat-sys-title-medium-weight, 500),
          subtitle-text-size: var(--mat-sys-body-small-size),
          subtitle-text-color: var(--mat-sys-on-surface-variant),
        )
      );
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateCard {
  readonly template = input.required<BudgetTemplate>();
  readonly summary = input<TemplateSummary | undefined>(undefined);
  readonly currency = input<SupportedCurrency>('CHF');

  protected readonly emoji = computed(() => {
    const match = LEADING_EMOJI_REGEX.exec(this.template().name);
    return match ? match[1] : null;
  });

  protected readonly displayName = computed(() => {
    const name = this.template().name;
    return name.replace(LEADING_EMOJI_REGEX, '').trim() || name;
  });
}
