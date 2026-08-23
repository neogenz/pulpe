import { provideZonelessChangeDetection, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { API_ERROR_CODES } from 'pulpe-shared';
import { ApiError } from '@core/api/api-error';
import { Logger } from '@core/logging/logger';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import McpConsent from './mcp-consent';
import { McpConsentStore } from './mcp-consent-store';

describe('McpConsent', () => {
  let fixture: ComponentFixture<McpConsent>;
  let store: {
    authorizationId: ReturnType<typeof signal<string | null>>;
    clientName: ReturnType<typeof signal<string | null>>;
    mode: ReturnType<typeof signal<'read' | 'read_write'>>;
    load: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    deny: ReturnType<typeof vi.fn>;
  };

  async function setup(queryParams: Record<string, string>): Promise<void> {
    store = {
      authorizationId: signal<string | null>(null),
      clientName: signal<string | null>(null),
      mode: signal<'read' | 'read_write'>('read_write'),
      load: vi.fn(async () => {
        store.clientName.set('ChatGPT');
      }),
      approve: vi.fn(),
      deny: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [McpConsent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideRouter([]),
        ...provideTranslocoForTest(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(queryParams) },
          },
        },
        {
          provide: Logger,
          useValue: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
          },
        },
      ],
    })
      .overrideComponent(McpConsent, {
        set: { providers: [{ provide: McpConsentStore, useValue: store }] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(McpConsent);
    await fixture.whenStable();
  }

  const text = (testId: string): string =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`)
      ?.textContent ?? '';

  it('names the client from the authorization request, not from the URL', async () => {
    await setup({ authorization_id: 'auth-1', client: 'Evil Corp' });
    expect(store.load).toHaveBeenCalledWith('auth-1');
    expect(text('mcp-consent-title')).toContain('ChatGPT');
    expect(fixture.nativeElement.textContent).not.toContain('Evil Corp');
  });

  it('shows an error and no form when the request id is missing', async () => {
    await setup({});
    expect(store.load).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[data-testid="mcp-consent-pin"]'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Aucune demande de connexion',
    );
  });

  it('reports a wrong code and keeps the page, without leaving', async () => {
    await setup({ authorization_id: 'auth-1' });
    store.approve.mockRejectedValue(
      new ApiError(
        'bad pin',
        API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED,
        400,
        undefined,
      ),
    );
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    const component = fixture.componentInstance as unknown as {
      form: { setValue: (v: { vaultCode: string }) => void };
      onApprove: () => Promise<void>;
    };
    component.form.setValue({ vaultCode: '1234' });
    await component.onApprove();
    await fixture.whenStable();

    expect(store.approve).toHaveBeenCalledWith('1234');
    expect(assign).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Code PIN incorrect');
    vi.unstubAllGlobals();
  });

  it('sends the browser to the client callback after an explicit decision', async () => {
    await setup({ authorization_id: 'auth-1' });
    store.deny.mockResolvedValue(
      'https://client.example/cb?error=access_denied',
    );
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    await (
      fixture.componentInstance as unknown as { onDeny: () => Promise<void> }
    ).onDeny();

    expect(assign).toHaveBeenCalledWith(
      'https://client.example/cb?error=access_denied',
    );
    vi.unstubAllGlobals();
  });
});
