/**
 * @deprecated This component is deprecated. Template display is now handled by
 * TemplateListItem component. This component will be removed in a future version.
 */
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type BudgetTemplate } from '@pulpe/shared';

@Component({
  selector: 'pulpe-selected-template-card',
  imports: [MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-content class="py-3">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-label-large text-on-surface">
              {{ template().name }}
              @if (template().isDefault) {
                <mat-icon
                  class="text-label-small align-middle text-primary ml-1"
                >
                  star
                </mat-icon>
              }
            </h4>
            @if (template().description) {
              <p class="text-body-medium text-on-surface-variant mt-1">
                {{ template().description }}
              </p>
            }
          </div>
          <button
            mat-icon-button
            type="button"
            (click)="clearTemplate.emit()"
            matTooltip="Retirer le modèle"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectedTemplateCard {
  template = input.required<BudgetTemplate>();
  clearTemplate = output<void>();
}
