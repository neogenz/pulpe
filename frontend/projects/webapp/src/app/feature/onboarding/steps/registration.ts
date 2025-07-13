import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
  afterNextRender,
  ElementRef,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  standalone: true,
  imports: [
    FormsModule,
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
          required
          [(ngModel)]="emailValue"
          (ngModelChange)="updateOnboardingEmail()"
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
          required
          [(ngModel)]="passwordValue"
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

      <div class="flex justify-between">
        <button
          mat-raised-button
          type="button"
          (click)="goToPrevious()"
          [disabled]="onboardingStore.isSubmitting()"
        >
          Précédent
        </button>
        <button
          mat-raised-button
          color="primary"
          type="button"
          (click)="registerAndCreateAccount()"
          [disabled]="!canContinue() || onboardingStore.isSubmitting()"
        >
          {{ onboardingStore.retryButtonText() }}
        </button>
      </div>
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

  public emailValue = linkedSignal<string>(
    () => this.onboardingStore.data().email,
  );
  public passwordValue = signal<string>('');
  protected hidePassword = signal<boolean>(true);

  public canContinue = computed(() => {
    if (this.onboardingStore.isAuthenticationCompleted()) {
      return true;
    }

    const password = this.passwordValue();
    return this.onboardingStore.canSubmitRegistration(password);
  });

  constructor() {
    effect(() => {
      this.onboardingStore.setCanContinue(this.canContinue());
      this.onboardingStore.setLayoutData(this.#onboardingLayoutData());
      this.onboardingStore.setNextButtonText(
        this.onboardingStore.retryButtonText(),
      );
    });

    afterNextRender(() => {
      this.#elementRef.nativeElement
        .querySelector('input[type="email"]')
        ?.focus();
    });
  }

  protected updateOnboardingEmail(): void {
    const currentData = this.onboardingStore.data();
    this.onboardingStore.updatePersonalInfo(
      currentData.firstName,
      this.emailValue(),
    );
  }

  protected goToPrevious(): void {
    this.#router.navigate(['/onboarding/transport']);
  }

  protected async registerAndCreateAccount(): Promise<void> {
    if (!this.canContinue() || this.onboardingStore.isSubmitting()) return;

    const result = await this.onboardingStore.processCompleteRegistration(
      this.emailValue(),
      this.passwordValue(),
    );

    if (result.success) {
      this.#router.navigate([ROUTES.CURRENT_MONTH]);
    }
  }
}
