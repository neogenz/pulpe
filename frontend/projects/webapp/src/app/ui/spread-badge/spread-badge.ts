import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * PUL-17 — status chip marking a budget line as part of a spread group
 * ("lissage": one expense distributed in equal parts across several months).
 *
 * Icon + label form a single unit (the icon alone is ambiguous). The
 * `timelapse` glyph (a circle filling over time) reads as "accumulates month
 * after month" — matching the spread's progressive cumulé across N months.
 * Never `event_repeat`/`repeat` (those mean recurrence) nor a bare calendar
 * (which says nothing about spreading).
 */
@Component({
  selector: 'pulpe-spread-badge',
  imports: [MatIconModule, MatTooltipModule, TranslocoPipe],
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 shrink-0
             bg-primary-container text-on-primary-container text-label-small font-medium"
      [matTooltip]="'budgetLine.spread.glyphTooltip' | transloco"
      matTooltipPosition="above"
    >
      <mat-icon class="text-sm! shrink-0 h-auto! w-auto!">timelapse</mat-icon>
      {{ 'budgetLine.spread.badgeLabel' | transloco }}
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpreadBadge {}
