import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  viewChild,
  HostListener,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { OnboardingStore } from '../onboarding-store';

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
    <div class="gap-6 h-full flex flex-col">
      <div class="text-center space-y-2">
        <h1 class="text-headline-large text-on-surface">
          Comment je dois t'appeler ?
        </h1>
        <p class="text-body-large text-on-surface-variant leading-relaxed">
          Ton prénom va m'aider à savoir comment je vais devoir t'appeler tout
          au long de notre collaboration. Il ne sera en aucun cas communiqué.
        </p>
      </div>

      <mat-form-field class="w-full" appearance="fill">
        <mat-label>Prénom</mat-label>
        <input
          matInput
          [formControl]="firstNameControl"
          placeholder="Quel est ton prénom ?"
          data-testid="first-name-input"
          #firstNameInput
        />
        <mat-icon matPrefix>person</mat-icon>
      </mat-form-field>

      <div class="flex gap-4 p-4 md:p-0 w-full mt-auto">
        <button
          mat-stroked-button
          class="flex-1"
          data-testid="previous-button"
          (click)="onPrevious()"
        >
          Précédent
        </button>
        <button
          mat-flat-button
          color="primary"
          class="flex-1"
          [disabled]="!isValid()"
          data-testid="next-button"
          (click)="onNext()"
        >
          Suivant
        </button>
      </div>
    </div>
  `,
})
export default class PersonalInfo {
  readonly #store = inject(OnboardingStore);
  readonly #router = inject(Router);
  readonly firstNameInput =
    viewChild<ElementRef<HTMLInputElement>>('firstNameInput');

  protected readonly firstNameControl = new FormControl<string>(
    this.#store.data().firstName,
    {
      validators: [Validators.required],
      nonNullable: true,
    },
  );

  readonly #formStatus = toSignal(this.firstNameControl.statusChanges, {
    initialValue: this.firstNameControl.status,
  });

  protected readonly isValid = computed(() => {
    const status = this.#formStatus();
    return status === 'VALID';
  });

  constructor() {
    afterNextRender(() => {
      this.firstNameInput()?.nativeElement.focus();
    });
  }

  @HostListener('keydown.enter')
  onEnter(): void {
    this.#handleNext();
  }

  onNext(): void {
    this.#handleNext();
  }

  onPrevious(): void {
    this.#router.navigate(['/onboarding/welcome']);
  }

  #handleNext(): void {
    if (!this.isValid()) {
      this.firstNameControl.markAsTouched();
      return;
    }

    this.#store.updateField('firstName', this.firstNameControl.value.trim());
    this.#router.navigate(['/onboarding/income']);
  }
}
