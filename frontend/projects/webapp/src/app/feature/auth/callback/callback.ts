import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'pulpe-auth-callback',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .container {
        min-height: 100vh;
        background: var(--mat-sys-surface-container-low);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }

      .card {
        background: var(--mat-sys-surface-container);
        color: var(--mat-sys-on-surface);
        border-radius: var(--mat-sys-corner-large);
        box-shadow: var(--mat-sys-elevation-3);
        padding: 2rem;
        max-width: 28rem;
        width: 100%;
        text-align: center;
      }

      .content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .icon-container {
        width: 4rem;
        height: 4rem;
        border-radius: var(--mat-sys-corner-full);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
      }

      .icon-container.loading {
        background: var(--mat-sys-primary-container);
      }

      .icon-container.error {
        background: var(--mat-sys-error-container);
      }

      .icon-container.success {
        background: var(--mat-sys-tertiary-container);
      }

      .icon {
        font-size: 2rem;
      }

      .icon.loading {
        color: var(--mat-sys-on-primary-container);
      }

      .icon.error {
        color: var(--mat-sys-on-error-container);
      }

      .icon.success {
        color: var(--mat-sys-on-tertiary-container);
      }

      .spinner {
        margin: 0 auto;
      }

      .title {
        font-size: var(--mat-sys-typescale-headline-small-size);
        font-weight: var(--mat-sys-typescale-headline-small-weight);
        line-height: var(--mat-sys-typescale-headline-small-line-height);
        color: var(--mat-sys-on-surface);
        margin: 0;
      }

      .description {
        font-size: var(--mat-sys-typescale-body-medium-size);
        line-height: var(--mat-sys-typescale-body-medium-line-height);
        color: var(--mat-sys-on-surface-variant);
        margin: 0;
      }

      .button-full {
        width: 100%;
      }
    `,
  ],
  template: `
    <div class="container">
      <div class="card">
        @if (isLoading()) {
          <div class="content">
            <mat-spinner diameter="48" class="spinner"></mat-spinner>
            <h1 class="title">Connexion en cours...</h1>
            <p class="description">
              Veuillez patienter pendant que nous vous connectons.
            </p>
          </div>
        } @else if (errorMessage()) {
          <div class="content">
            <div class="icon-container error">
              <mat-icon class="icon error">error</mat-icon>
            </div>
            <h1 class="title">Erreur de connexion</h1>
            <p class="description">
              {{ errorMessage() }}
            </p>
            <button
              mat-raised-button
              color="primary"
              class="button-full"
              (click)="goToLogin()"
            >
              Retour à la connexion
            </button>
          </div>
        } @else {
          <div class="content">
            <div class="icon-container success">
              <mat-icon class="icon success">check_circle</mat-icon>
            </div>
            <h1 class="title">Connexion réussie !</h1>
            <p class="description">Redirection vers votre budget...</p>
          </div>
        }
      </div>
    </div>
  `,
})
export default class AuthCallback implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  protected isLoading = signal<boolean>(true);
  protected errorMessage = signal<string>('');

  async ngOnInit(): Promise<void> {
    try {
      // Attendre un peu pour que Supabase traite l'authentification
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Vérifier si l'utilisateur est maintenant connecté
      const session = await this.authService.getCurrentSession();

      if (session) {
        // Succès - rediriger vers l'app
        this.isLoading.set(false);
        setTimeout(() => {
          this.router.navigate(['/app']);
        }, 1500);
      } else {
        // Pas de session - il y a peut-être des paramètres d'erreur dans l'URL
        const error =
          this.route.snapshot.queryParams['error_description'] ||
          this.route.snapshot.queryParams['error'] ||
          'Impossible de vous connecter. Le lien a peut-être expiré.';

        this.errorMessage.set(error);
        this.isLoading.set(false);
      }
    } catch (error) {
      console.error("Erreur dans le callback d'authentification:", error);
      this.errorMessage.set("Une erreur inattendue s'est produite.");
      this.isLoading.set(false);
    }
  }

  protected goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
