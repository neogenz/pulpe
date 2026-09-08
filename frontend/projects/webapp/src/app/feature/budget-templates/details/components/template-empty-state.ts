import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { StateCard } from '@ui/state-card/state-card';

@Component({
  selector: 'pulpe-template-empty-state',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe, StateCard],
  template: `
    <pulpe-state-card
      variant="empty"
      [title]="'template.emptyState.title' | transloco"
      [message]="'template.emptyState.subtitle' | transloco"
      testId="template-empty-state"
    >
      <button
        matButton="filled"
        class="mt-6"
        (click)="addLine.emit()"
        data-testid="template-empty-state-add"
      >
        <mat-icon>add</mat-icon>
        {{ 'template.addLine' | transloco }}
      </button>
    </pulpe-state-card>
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
