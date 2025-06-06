import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'pulpe-magic-link-sent',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
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

      .icon-container {
        width: 4rem;
        height: 4rem;
        background: var(--mat-sys-tertiary-container);
        border-radius: var(--mat-sys-corner-full);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1.5rem auto;
      }

      .icon {
        color: var(--mat-sys-on-tertiary-container);
        font-size: 2rem;
      }

      .title {
        font-size: var(--mat-sys-typescale-headline-medium-size);
        font-weight: var(--mat-sys-typescale-headline-medium-weight);
        line-height: var(--mat-sys-typescale-headline-medium-line-height);
        color: var(--mat-sys-on-surface);
        margin: 0 0 1rem 0;
      }

      .description {
        font-size: var(--mat-sys-typescale-body-medium-size);
        line-height: var(--mat-sys-typescale-body-medium-line-height);
        color: var(--mat-sys-on-surface-variant);
        margin: 0 0 1.5rem 0;
      }

      .email-highlight {
        color: var(--mat-sys-primary);
        font-weight: var(--mat-sys-typescale-body-medium-weight);
      }

      .button-group {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .button-full {
        width: 100%;
      }

      .footer-text {
        font-size: var(--mat-sys-typescale-body-small-size);
        color: var(--mat-sys-on-surface-variant);
        margin: 1.5rem 0 0 0;
      }

      .footer-link {
        color: var(--mat-sys-primary);
        background: none;
        border: none;
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
        font-size: inherit;
      }

      .footer-link:hover {
        color: var(--mat-sys-primary);
        text-decoration: none;
      }
    `,
  ],
  template: `
    <div class="container">
      <div class="card">
        <div class="icon-container">
          <mat-icon class="icon">email</mat-icon>
        </div>

        <h1 class="title">Email envoyé !</h1>

        <p class="description">
          Nous avons envoyé un lien magique à
          <span class="email-highlight">{{ email() }}</span
          >. Cliquez sur le lien dans votre email pour accéder à votre budget
          personnalisé.
        </p>

        <div class="button-group">
          <button
            mat-raised-button
            color="primary"
            class="button-full"
            (click)="openEmailApp()"
          >
            <mat-icon>mail_outline</mat-icon>
            Ouvrir l'app email
          </button>

          <button
            mat-outlined-button
            class="button-full"
            (click)="goBackToOnboarding()"
          >
            Retour à l'inscription
          </button>
        </div>

        <p class="footer-text">
          Vous n'avez pas reçu l'email ? Vérifiez vos spams ou
          <button class="footer-link" (click)="goBackToOnboarding()">
            réessayez
          </button>
        </p>
      </div>
    </div>
  `,
})
export default class MagicLinkSent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected email = signal<string>('');

  ngOnInit(): void {
    this.email.set(this.route.snapshot.queryParams['email'] || '');
  }

  protected openEmailApp(): void {
    // Tenter d'ouvrir l'app email par défaut
    if (this.email()) {
      window.location.href = `mailto:${this.email()}`;
    }
  }

  protected goBackToOnboarding(): void {
    this.router.navigate(['/onboarding/registration']);
  }
}
