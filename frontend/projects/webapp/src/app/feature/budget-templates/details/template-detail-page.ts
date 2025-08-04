import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { BudgetTemplatesState } from '../services/budget-templates-state';
import { BaseLoadingComponent } from '../../../ui/loading';

@Component({
  selector: 'pulpe-template-detail-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    BaseLoadingComponent,
  ],
  template: `
    <div class="flex flex-col gap-4 h-full" data-testid="template-detail-page">
      <header class="flex items-center gap-4" data-testid="page-header">
        <button
          matIconButton
          (click)="navigateBack()"
          aria-label="Retour"
          data-testid="back-button"
        >
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1 class="text-display-small" data-testid="page-title">
          Détails du modèle
        </h1>
      </header>

      @if (state.isLoading()) {
        <pulpe-base-loading
          message="Chargement du modèle..."
          size="large"
          testId="template-loading"
        />
      } @else if (template()) {
        <mat-card data-testid="template-details-card">
          <mat-card-header>
            <mat-card-title>{{ template()!.name }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (template()!.description) {
              <p class="text-body-large">{{ template()!.description }}</p>
            }
            @if (template()!.isDefault) {
              <div class="mt-4">
                <mat-icon class="align-middle">star</mat-icon>
                <span class="ml-2">Modèle par défaut</span>
              </div>
            }
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      padding: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TemplateDetailPage implements OnInit {
  #router = inject(Router);
  #route = inject(ActivatedRoute);
  protected readonly state = inject(BudgetTemplatesState);

  template = this.state.selectedTemplate;

  ngOnInit() {
    const id = this.#route.snapshot.paramMap.get('id');
    if (id) {
      this.state.selectTemplate(id);
    }
  }

  navigateBack() {
    this.#router.navigate(['/budget-templates']);
  }
}
