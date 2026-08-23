import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { SpinnerComponent } from 'ngx-unicode-spinners';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { API_ERROR_CODES } from 'pulpe-shared';
import { isApiError } from '@core/api/api-error';
import { VAULT_CODE_LENGTH, VAULT_CODE_VALIDATORS } from '@core/auth';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';
import { ErrorAlert } from '@ui/error-alert';
import { McpConsentStore } from './mcp-consent-store';

/**
 * OAuth consent page for AI agents: the only screen that asks the vault
 * code on behalf of a third party. The client name comes from the
 * authorization request, never from the URL or the user.
 */
@Component({
  selector: 'pulpe-mcp-consent',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    SpinnerComponent,
    RouterLink,
    ErrorAlert,
    TranslocoPipe,
  ],
  providers: [McpConsentStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pulpe-entry-card w-full max-w-md"
      data-testid="mcp-consent-page"
    >
      @if (clientName(); as client) {
        <div class="mb-6 pb-5 border-b border-outline-variant">
          <h1
            class="text-headline-medium font-bold text-on-surface leading-tight mb-1"
            data-testid="mcp-consent-title"
          >
            {{ 'auth.mcpConsent.title' | transloco: { client } }}
          </h1>
          <p class="text-body-medium text-on-surface-variant">
            {{ 'auth.mcpConsent.subtitle' | transloco: { client } }}
          </p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onApprove()" class="space-y-6">
          <mat-radio-group
            class="flex flex-col gap-2"
            [value]="store.mode()"
            (change)="store.mode.set($event.value)"
            data-testid="mcp-consent-mode"
          >
            <mat-radio-button value="read" data-testid="mcp-consent-mode-read">
              <span class="font-medium">{{
                'auth.mcpConsent.modeRead' | transloco
              }}</span>
              <span class="block text-body-small text-on-surface-variant">
                {{ 'auth.mcpConsent.modeReadDescription' | transloco }}
              </span>
            </mat-radio-button>
            <mat-radio-button
              value="read_write"
              data-testid="mcp-consent-mode-read-write"
            >
              <span class="font-medium">{{
                'auth.mcpConsent.modeReadWrite' | transloco
              }}</span>
              <span class="block text-body-small text-on-surface-variant">
                {{ 'auth.mcpConsent.modeReadWriteDescription' | transloco }}
              </span>
            </mat-radio-button>
          </mat-radio-group>

          <section>
            <h2 class="text-title-medium font-semibold text-on-surface mb-3">
              {{ 'auth.mcpConsent.warningsTitle' | transloco }}
            </h2>
            <ul class="space-y-3 text-body-medium">
              @for (warning of warnings; track warning.icon) {
                <li class="flex gap-2">
                  <mat-icon class="shrink-0 text-primary">{{
                    warning.icon
                  }}</mat-icon>
                  <div>
                    <p class="font-medium text-on-surface">
                      {{ warning.title | transloco: { client } }}
                    </p>
                    <p class="text-on-surface-variant">
                      {{ warning.body | transloco: { client } }}
                    </p>
                  </div>
                </li>
              }
            </ul>
          </section>

          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'auth.mcpConsent.pinLabel' | transloco }}</mat-label>
            <input
              matInput
              type="password"
              inputmode="numeric"
              autocomplete="off"
              [attr.maxlength]="VAULT_CODE_LENGTH"
              formControlName="vaultCode"
              data-testid="mcp-consent-pin"
              (input)="errorMessage.set('')"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <mat-hint>{{
              'auth.mcpConsent.pinHint' | transloco: { client }
            }}</mat-hint>
          </mat-form-field>

          <pulpe-error-alert [message]="errorMessage()" />

          <div class="flex gap-3 justify-end">
            <button
              matButton
              type="button"
              (click)="onDeny()"
              [disabled]="isSubmitting()"
              data-testid="mcp-consent-deny"
            >
              {{ 'common.cancel' | transloco }}
            </button>
            <button
              matButton="filled"
              type="submit"
              [disabled]="isSubmitting() || form.invalid"
              data-testid="mcp-consent-approve"
            >
              @if (isSubmitting()) {
                <ngx-unicode-spinners name="braille" fontSize="1rem" />
              } @else {
                {{ 'auth.mcpConsent.authorize' | transloco }}
              }
            </button>
          </div>

          <p class="text-center">
            <a
              [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_PRIVACY]"
              fragment="ai-assistants"
              target="_blank"
              class="text-body-small text-primary hover:underline"
              data-testid="mcp-consent-privacy-link"
            >
              {{ 'auth.mcpConsent.privacyLink' | transloco }}
            </a>
          </p>
        </form>
      } @else if (errorMessage()) {
        <pulpe-error-alert [message]="errorMessage()" />
      } @else {
        <div class="flex justify-center py-8">
          <ngx-unicode-spinners
            name="braille"
            fontSize="1.5rem"
            color="var(--mat-sys-primary)"
          />
        </div>
      }
    </div>
  `,
})
export default class McpConsent {
  protected readonly store = inject(McpConsentStore);
  readonly #route = inject(ActivatedRoute);
  readonly #formBuilder = inject(FormBuilder);
  readonly #transloco = inject(TranslocoService);
  readonly #logger = inject(Logger);

  protected readonly ROUTES = ROUTES;
  protected readonly VAULT_CODE_LENGTH = VAULT_CODE_LENGTH;
  protected readonly warnings = [
    {
      icon: 'swap_horiz',
      title: 'auth.mcpConsent.warningDataTitle',
      body: 'auth.mcpConsent.warningDataBody',
    },
    {
      icon: 'key',
      title: 'auth.mcpConsent.warningKeyTitle',
      body: 'auth.mcpConsent.warningKeyBody',
    },
    {
      icon: 'link_off',
      title: 'auth.mcpConsent.warningRevokeTitle',
      body: 'auth.mcpConsent.warningRevokeBody',
    },
  ];
  protected readonly clientName = computed(() => this.store.clientName());
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.#formBuilder.nonNullable.group({
    vaultCode: ['', VAULT_CODE_VALIDATORS],
  });

  constructor() {
    const authorizationId =
      this.#route.snapshot.queryParamMap.get('authorization_id');
    if (!authorizationId) {
      this.errorMessage.set(this.#t('auth.mcpConsent.missingRequest'));
      return;
    }
    this.store.load(authorizationId).catch((error) => this.#fail(error));
  }

  protected async onApprove(): Promise<void> {
    if (this.isSubmitting() || this.form.invalid) return;
    await this.#decide(() =>
      this.store.approve(this.form.getRawValue().vaultCode),
    );
  }

  protected async onDeny(): Promise<void> {
    if (this.isSubmitting()) return;
    await this.#decide(() => this.store.deny());
  }

  async #decide(decision: () => Promise<string>): Promise<void> {
    this.isSubmitting.set(true);
    this.errorMessage.set('');
    try {
      // The client's callback URL (state and code, or the OAuth error) is
      // only reached after an explicit decision.
      window.location.assign(await decision());
    } catch (error) {
      this.#fail(error);
      this.form.controls.vaultCode.setValue('');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  #fail(error: unknown): void {
    this.#logger.error('MCP consent failed:', error);
    const code = isApiError(error) ? error.code : undefined;
    const status = isApiError(error) ? error.status : undefined;
    if (code === API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED) {
      this.errorMessage.set(this.#t('auth.vaultCode.incorrectPin'));
    } else if (code === API_ERROR_CODES.MCP_AUTHORIZATION_UNPROCESSABLE) {
      this.errorMessage.set(this.#t('auth.mcpConsent.invalidRequest'));
    } else if (status === 429) {
      this.errorMessage.set(this.#t('auth.vaultCode.rateLimited'));
    } else {
      this.errorMessage.set(this.#t('common.somethingWentWrong'));
    }
  }

  #t(key: string): string {
    return this.#transloco.translate(key);
  }
}
