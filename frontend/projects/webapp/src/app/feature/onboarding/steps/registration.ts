import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  afterNextRender,
  ElementRef,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  ReactiveFormsModule,
  FormControl,
  Validators,
  FormGroup,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { ROUTES } from '../../../core/routing/routes-constants';
import {
  OnboardingStore,
  type OnboardingLayoutData,
} from '../onboarding-store';
import { map, startWith } from 'rxjs';

@Component({
  selector: 'pulpe-registration',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Le template est suffisamment grand pour justifier un fichier séparé
  // mais pour la revue, le garder inline est acceptable.
  template: `
    <!-- Utiliser un formGroup est une bonne pratique pour regrouper les contrôles -->
    <form
      [formGroup]="registrationForm"
      (ngSubmit)="registerAndCreateAccount()"
    >
      <div class="space-y-6">
        <mat-form-field class="w-full" appearance="fill">
          <mat-label>Email</mat-label>
          <input
            matInput
            type="email"
            placeholder="Email"
            formControlName="email"
            [disabled]="isFormDisabled()"
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
            [disabled]="isFormDisabled()"
          />
          <mat-icon matPrefix>lock</mat-icon>
          <button
            matIconButton
            matSuffix
            type="button"
            (click)="hidePassword.set(!hidePassword())"
            [attr.aria-label]="'Afficher le mot de passe'"
            [attr.aria-pressed]="!hidePassword()"
            [disabled]="onboardingStore.isAuthenticationCompleted()"
          >
            <mat-icon>{{
              hidePassword() ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          <mat-hint
            >Le mot de passe doit contenir au minimum 8 caractères</mat-hint
          >
        </mat-form-field>

        @if (onboardingStore.isAuthenticationCompleted()) {
          <div
            class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded"
          >
            ✅ Compte créé avec succès. Finalisation en cours...
          </div>
        }

        @if (onboardingStore.submissionError(); as error) {
          <div
            class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded"
          >
            {{ error }}
          </div>
        }
        @if (onboardingStore.submissionSuccess(); as successMessage) {
          <div
            class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded"
          >
            {{ successMessage }}
          </div>
        }
      </div>
    </form>
  `,
})
export default class Registration {
  #router = inject(Router);
  #elementRef = inject(ElementRef);
  protected readonly onboardingStore = inject(OnboardingStore);

  // Utiliser un FormGroup pour une meilleure organisation et validation groupée
  protected readonly registrationForm = new FormGroup({
    email: new FormControl('', {
      validators: [Validators.required, Validators.email],
      nonNullable: true,
    }),
    password: new FormControl('', {
      validators: [Validators.required, Validators.minLength(8)],
      nonNullable: true,
    }),
  });

  protected hidePassword = signal(true);

  #isFormValid = toSignal(
    this.registrationForm.statusChanges.pipe(
      startWith(this.registrationForm.status),
      map((status) => status === 'VALID'),
    ),
    { initialValue: false },
  );

  // Signal calculé pour la désactivation, plus propre et réutilisable.
  protected isFormDisabled = computed(
    () =>
      this.onboardingStore.isSubmitting() ||
      this.onboardingStore.isAuthenticationCompleted(),
  );

  constructor() {
    const isRetry =
      this.onboardingStore.processState().completedSteps.length > 0;
    const layoutData: OnboardingLayoutData = {
      title: isRetry ? 'Reprise du processus' : 'Presque fini !',
      subtitle: isRetry
        ? 'Finalisons la création de votre compte.'
        : 'Créez votre compte pour accéder à votre budget personnalisé.',
      currentStep: 8,
    };
    this.onboardingStore.setLayoutData(layoutData);

    effect(() => {
      const canContinue =
        this.#isFormValid() || this.onboardingStore.isAuthenticationCompleted();
      this.onboardingStore.setCanContinue(canContinue);
    });

    this.onboardingStore.nextClicked$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.registerAndCreateAccount());

    afterNextRender(() => {
      this.#elementRef.nativeElement
        .querySelector('input[type="email"]')
        ?.focus();
    });

    const existingEmail = this.onboardingStore.data().email;
    if (existingEmail) {
      this.registrationForm.controls.email.setValue(existingEmail);
    }
  }

  protected async registerAndCreateAccount(): Promise<void> {
    if (!this.registrationForm.valid || this.isFormDisabled()) {
      this.registrationForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.registrationForm.getRawValue();

    this.onboardingStore.updatePersonalInfo(
      this.onboardingStore.data().firstName,
      email,
    );

    const result = await this.onboardingStore.processCompleteRegistration(
      email,
      password,
    );

    if (result.success) {
      this.#router.navigate([ROUTES.CURRENT_MONTH]);
    }
  }
}
