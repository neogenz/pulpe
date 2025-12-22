import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  type OnDestroy,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/routing';
import { OnboardingStore } from '../onboarding-store';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'pulpe-registration',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gap-6 h-full flex flex-col">
      <div class="text-center space-y-2 mb-6">
        <h1 class="text-headline-large text-on-surface">
          Création de ton compte
        </h1>
        <p class="text-body-large text-on-surface-variant leading-relaxed">
          Créer ton compte pour commencer à utiliser Pulpe.
        </p>
      </div>

      <form [formGroup]="registrationForm" (ngSubmit)="onSubmit()">
        <mat-form-field class="w-full" appearance="fill">
          <mat-label>Email</mat-label>
          <input
            matInput
            type="email"
            placeholder="Email"
            formControlName="email"
            [disabled]="store.isLoading()"
            data-testid="email-input"
            #emailInput
          />
          <mat-icon matPrefix>email</mat-icon>
        </mat-form-field>

        <mat-form-field class="w-full" appearance="fill">
          <mat-label>Mot de passe</mat-label>
          <input
            matInput
            [type]="hidePassword() ? 'password' : 'text'"
            placeholder="Mot de passe"
            formControlName="password"
            [disabled]="store.isLoading()"
            data-testid="password-input"
          />
          <mat-icon matPrefix>lock</mat-icon>
          <button
            matIconButton
            matSuffix
            type="button"
            (click)="hidePassword.set(!hidePassword())"
            [attr.aria-label]="'Afficher le mot de passe'"
            [disabled]="store.isLoading()"
            data-testid="password-visibility-toggle"
          >
            <mat-icon>{{
              hidePassword() ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          <mat-hint
            >Le mot de passe doit contenir au minimum 8 caractères</mat-hint
          >
        </mat-form-field>

        <div class="mt-6">
          <mat-checkbox
            formControlName="acceptTerms"
            [disabled]="store.isLoading()"
            data-testid="accept-terms-checkbox"
          >
            <span class="text-body-medium">
              J'accepte les
              <a
                [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_TERMS]"
                target="_blank"
                class="text-primary underline"
                (click)="$event.stopPropagation()"
              >
                Conditions d'Utilisation
              </a>
              et la
              <a
                [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_PRIVACY]"
                target="_blank"
                class="text-primary underline"
                (click)="$event.stopPropagation()"
              >
                Politique de Confidentialité
              </a>
            </span>
          </mat-checkbox>
        </div>
      </form>

      <div class="flex gap-4 p-4 md:p-0 w-full mt-auto">
        <button
          matButton="outlined"
          class="flex-1"
          data-testid="previous-button"
          (click)="onPrevious()"
        >
          Précédent
        </button>
        <button
          matButton="filled"
          color="primary"
          class="flex-1 flex items-center justify-center"
          data-testid="submit-button"
          [disabled]="!isValid() || store.isLoading()"
          (click)="onSubmit()"
        >
          <div class="flex items-center justify-center gap-2">
            @if (store.isLoading()) {
              <mat-progress-spinner
                mode="indeterminate"
                [diameter]="24"
                aria-label="Création en cours"
                role="progressbar"
                class="pulpe-loading-indicator pulpe-loading-small flex-shrink-0"
              />
            }
            Créer
          </div>
        </button>
      </div>
    </div>
  `,
})
export default class Registration implements OnDestroy {
  readonly #router = inject(Router);
  protected readonly store = inject(OnboardingStore);
  protected readonly ROUTES = ROUTES;

  protected readonly registrationForm = new FormGroup({
    email: new FormControl(this.store.data().email, {
      validators: [Validators.required, Validators.email],
      nonNullable: true,
    }),
    password: new FormControl('', {
      validators: [Validators.required, Validators.minLength(8)],
      nonNullable: true,
    }),
    acceptTerms: new FormControl(false, {
      validators: [Validators.requiredTrue],
      nonNullable: true,
    }),
  });

  protected readonly hidePassword = signal(true);

  protected readonly formStatus = toSignal(this.registrationForm.statusChanges);
  protected readonly isValid = computed(() => this.formStatus() === 'VALID');

  constructor() {
    afterNextRender(() => {
      const emailInput = document.querySelector(
        'input[type="email"]',
      ) as HTMLInputElement;
      emailInput?.focus();
    });
  }

  ngOnDestroy(): void {
    this.store.clearError();
  }

  @HostListener('keydown.enter')
  onEnter(): void {
    if (this.isValid() && !this.store.isLoading()) {
      this.onSubmit();
    }
  }

  onNext(): void {
    this.onSubmit();
  }

  onPrevious(): void {
    this.#router.navigate([
      '/',
      ROUTES.ONBOARDING,
      ROUTES.ONBOARDING_LEASING_CREDIT,
    ]);
  }

  async onSubmit(): Promise<void> {
    if (!this.isValid() || this.store.isLoading()) {
      this.registrationForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.registrationForm.getRawValue();

    this.store.updateEmail(email);

    const success = await this.store.submitRegistration(email, password);

    if (success) {
      this.#router.navigate(['/', ROUTES.APP, ROUTES.CURRENT_MONTH]);
    }
  }
}
