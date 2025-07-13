import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  effect,
  afterNextRender,
  viewChild,
  ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {
  OnboardingStore,
  type OnboardingLayoutData,
} from '../onboarding-store';

@Component({
  selector: 'pulpe-personal-info',
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
        <mat-label>Prénom</mat-label>
        <input
          matInput
          [formControl]="firstNameControl"
          placeholder="Quel est ton prénom ?"
          #firstNameInput
        />
        <mat-icon matPrefix>person</mat-icon>
      </mat-form-field>
    </div>
  `,
})
export default class PersonalInfo {
  readonly #onboardingStore = inject(OnboardingStore);

  readonly firstNameInput =
    viewChild<ElementRef<HTMLInputElement>>('firstNameInput');

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: "Comment je dois t'appeler ?",
    subtitle:
      "Ton prénom va m'aider à savoir comment je vais devoir t'appeler tout au long de notre collaboration. Il ne sera en aucun cas communiqué.",
    currentStep: 1,
  };

  protected readonly firstNameControl = new FormControl<string>('', {
    validators: [Validators.required, Validators.minLength(1)],
    nonNullable: true,
  });

  readonly canContinue = computed(() => {
    return (
      this.firstNameControl.valid &&
      this.firstNameControl.value.trim().length > 0
    );
  });

  constructor() {
    effect(() => {
      this.#onboardingStore.setCanContinue(this.canContinue());
      this.#onboardingStore.setLayoutData(this.#onboardingLayoutData);
    });

    const existingFirstName = this.#onboardingStore.data().firstName;
    if (existingFirstName) {
      this.firstNameControl.setValue(existingFirstName);
    }

    // Subscribe to form changes
    this.firstNameControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.#onboardingStore.updateField('firstName', value || '');
      });

    // Set autofocus
    afterNextRender(() => {
      this.firstNameInput()?.nativeElement.focus();
    });
  }
}
