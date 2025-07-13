import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  afterNextRender,
  ElementRef,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
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
  template: `
    <div class="space-y-6">
      <mat-form-field class="w-full" appearance="fill">
        <mat-label>Email</mat-label>
        <input
          matInput
          type="email"
          placeholder="Email"
          [formControl]="emailControl"
          [disabled]="
            onboardingStore.isSubmitting() ||
            onboardingStore.isAuthenticationCompleted()
          "
        />
        <mat-icon matPrefix>email</mat-icon>
      </mat-form-field>

      <mat-form-field class="w-full" appearance="fill">
        <mat-label>Mot de passe</mat-label>
        <input
          matInput
          [type]="hidePassword() ? 'password' : 'text'"
          placeholder="Mot de passe"
          [formControl]="passwordControl"
          [disabled]="
            onboardingStore.isSubmitting() ||
            onboardingStore.isAuthenticationCompleted()
          "
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

      @if (onboardingStore.submissionError()) {
        <div
          class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded"
        >
          {{ onboardingStore.submissionError() }}
        </div>
      }
      @if (onboardingStore.submissionSuccess()) {
        <div
          class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded"
        >
          {{ onboardingStore.submissionSuccess() }}
        </div>
      }
    </div>
  `,
})
export default class Registration {
  #router = inject(Router);
  #elementRef = inject(ElementRef);
  protected readonly onboardingStore = inject(OnboardingStore);

  readonly #onboardingLayoutData = computed<OnboardingLayoutData>(() => {
    const isRetry =
      this.onboardingStore.processState().completedSteps.length > 0;
    return {
      title: isRetry ? 'Reprise du processus' : 'Presque fini !',
      subtitle: isRetry
        ? 'Finalisons la création de votre compte.'
        : 'Créez votre compte pour accéder à votre budget personnalisé.',
      currentStep: 8,
    };
  });

  protected readonly emailControl = new FormControl<string>('', {
    validators: [Validators.required, Validators.email],
    nonNullable: true,
  });
  protected readonly passwordControl = new FormControl<string>('', {
    validators: [Validators.required, Validators.minLength(8)],
    nonNullable: true,
  });
  protected hidePassword = signal<boolean>(true);

  protected canContinue = computed(() => {
    if (this.onboardingStore.isAuthenticationCompleted()) {
      return true;
    }

    const password = this.passwordControl.value;
    return (
      this.onboardingStore.canSubmitRegistration(password) &&
      this.emailControl.valid &&
      this.passwordControl.valid
    );
  });

  constructor() {
    effect(() => {
      this.onboardingStore.setCanContinue(this.canContinue());
      this.onboardingStore.setLayoutData(this.#onboardingLayoutData());
    });

    // Initialize form with existing data
    const existingEmail = this.onboardingStore.data().email;
    if (existingEmail) {
      this.emailControl.setValue(existingEmail);
    }

    // Subscribe to form changes
    this.emailControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((email) => {
        const currentData = this.onboardingStore.data();
        this.onboardingStore.updatePersonalInfo(
          currentData.firstName,
          email || '',
        );
      });

    // Listen for next button click from layout
    this.onboardingStore.nextClicked$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.registerAndCreateAccount();
      });

    afterNextRender(() => {
      this.#elementRef.nativeElement
        .querySelector('input[type="email"]')
        ?.focus();
    });
  }

  protected async registerAndCreateAccount(): Promise<void> {
    if (!this.canContinue() || this.onboardingStore.isSubmitting()) return;

    const result = await this.onboardingStore.processCompleteRegistration(
      this.emailControl.value,
      this.passwordControl.value,
    );

    if (result.success) {
      this.#router.navigate([ROUTES.CURRENT_MONTH]);
    }
  }
}
