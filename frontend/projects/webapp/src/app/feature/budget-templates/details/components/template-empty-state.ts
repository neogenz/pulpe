import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'pulpe-template-empty-state',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  template: `
    <div
      class="flex flex-col items-center justify-center text-center gap-4 py-12 px-4"
      data-testid="template-empty-state"
    >
      <div
        class="w-16 h-16 rounded-full bg-primary-container/40 text-primary flex items-center justify-center"
      >
        <mat-icon class="scale-150 flex! shrink-0!" aria-hidden="true">
          post_add
        </mat-icon>
      </div>
      <div class="flex flex-col gap-1 max-w-md">
        <h3 class="text-title-medium font-medium text-on-surface">
          {{ 'template.emptyState.title' | transloco }}
        </h3>
        <p class="text-body-medium text-on-surface-variant">
          {{ 'template.emptyState.subtitle' | transloco }}
        </p>
      </div>
      <button
        matButton="filled"
        (click)="addLine.emit()"
        data-testid="template-empty-state-add"
      >
        <mat-icon>add</mat-icon>
        {{ 'template.addLine' | transloco }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateEmptyState {
  readonly addLine = output<void>();
}
