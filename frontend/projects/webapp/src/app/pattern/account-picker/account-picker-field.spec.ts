import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatSelect, type MatSelectChange } from '@angular/material/select';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetApi } from '@core/asset/asset-api';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsStore } from '@core/user-settings';
import { createMockDataCache } from '@core/testing';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { createMockPostHogService } from '@app/testing/mock-posthog';
import {
  COMPTE_COURANT,
  LEASING,
  LIVRET,
  OLD_ACCOUNT,
  REVOLUT,
  TICKET_ASSETS,
  netWorthResponse,
} from '@app/testing/net-worth-fixtures';
import {
  AccountPickerField,
  injectInitialAccountId,
} from './account-picker-field';

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('AccountPickerField', () => {
  const getNetWorth$ = vi.fn();
  const postHog = createMockPostHogService();

  beforeEach(async () => {
    getNetWorth$.mockReset();
    postHog.isFeatureEnabled.mockReturnValue(true);
    await TestBed.configureTestingModule({
      imports: [AccountPickerField],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
        { provide: PostHogService, useValue: postHog },
        {
          provide: AssetApi,
          useValue: { cache: createMockDataCache(), getNetWorth$ },
        },
      ],
    }).compileComponents();
  });

  const render = async (
    value: string | null = null,
    inputs: Record<string, unknown> = {},
  ): Promise<ComponentFixture<AccountPickerField>> => {
    const fixture = TestBed.createComponent(AccountPickerField);
    fixture.componentRef.setInput('value', value);
    for (const [name, input] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, input);
    }
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return fixture;
  };

  const readOptions = async (
    fixture: ComponentFixture<AccountPickerField>,
  ): Promise<string[]> => {
    fixture.nativeElement
      .querySelector('.mat-mdc-select-trigger')
      .dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await settle();
    return Array.from(
      document.querySelectorAll(
        '.cdk-overlay-container mat-option, .cdk-overlay-container mat-optgroup .mat-mdc-optgroup-label',
      ),
    ).map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  };

  it('CA1: offers « Aucun », then what I have, then what I owe', async () => {
    getNetWorth$.mockReturnValue(of(netWorthResponse(TICKET_ASSETS)));
    const fixture = await render();

    expect(
      fixture.nativeElement.querySelector('mat-label').textContent.trim(),
    ).toBe('Compte');
    const options = await readOptions(fixture);
    expect(options.filter((text) => text !== '')).toEqual([
      'Aucun',
      "Ce que j'ai",
      'Compte courant',
      'Revolut',
      'Livret',
      'Ce que je dois',
      'Leasing',
    ]);
  });

  it('CA3: the closed field reads « Aucun » when no account is chosen', async () => {
    getNetWorth$.mockReturnValue(of(netWorthResponse(TICKET_ASSETS)));
    const fixture = await render();

    expect(
      fixture.nativeElement
        .querySelector('.mat-mdc-select-trigger')
        .textContent.trim(),
    ).toBe('Aucun');
  });

  it('keeps an archived account the movement already carries, and no other', async () => {
    getNetWorth$.mockReturnValue(
      of(netWorthResponse([COMPTE_COURANT, OLD_ACCOUNT])),
    );
    const fixture = await render(OLD_ACCOUNT.id);

    expect(await readOptions(fixture)).toContain('Ancien compte');
  });

  it('hides archived accounts the movement does not carry', async () => {
    getNetWorth$.mockReturnValue(
      of(netWorthResponse([COMPTE_COURANT, OLD_ACCOUNT])),
    );
    const fixture = await render();

    expect(await readOptions(fixture)).not.toContain('Ancien compte');
  });

  it('emits the picked account id, and null for « Aucun »', async () => {
    getNetWorth$.mockReturnValue(of(netWorthResponse(TICKET_ASSETS)));
    const fixture = await render();
    const emitted = vi.spyOn(fixture.componentInstance.valueChanged, 'emit');
    const select = fixture.debugElement.query(By.directive(MatSelect));

    select.componentInstance.selectionChange.emit({
      value: REVOLUT.id,
    } as MatSelectChange);
    select.componentInstance.selectionChange.emit({
      value: null,
    } as MatSelectChange);

    expect(emitted).toHaveBeenNthCalledWith(1, REVOLUT.id);
    expect(emitted).toHaveBeenNthCalledWith(2, null);
  });

  it('CA2: renders nothing with the flag off, and reads nothing', async () => {
    postHog.isFeatureEnabled.mockReturnValue(false);
    getNetWorth$.mockReturnValue(of(netWorthResponse(TICKET_ASSETS)));
    const fixture = await render();

    expect(fixture.debugElement.query(By.directive(MatSelect))).toBeNull();
    expect(getNetWorth$).not.toHaveBeenCalled();
  });

  it('CA2: renders nothing without an active item', async () => {
    getNetWorth$.mockReturnValue(of(netWorthResponse([OLD_ACCOUNT])));
    const fixture = await render();

    expect(fixture.debugElement.query(By.directive(MatSelect))).toBeNull();
  });

  it('renders nothing when the read fails', async () => {
    getNetWorth$.mockReturnValue(throwError(() => new Error('network')));
    const fixture = await render();

    expect(fixture.debugElement.query(By.directive(MatSelect))).toBeNull();
  });

  it('CA25: shows the error message under the field', async () => {
    getNetWorth$.mockReturnValue(of(netWorthResponse([LIVRET, LEASING])));
    const fixture = await render(LIVRET.id, {
      errorKey: 'netWorth.account.sameAsLink',
    });

    expect(
      fixture.debugElement
        .query(By.css('[data-testid="account-picker-error"]'))
        .nativeElement.textContent.trim(),
    ).toBe(
      "Choisis un autre compte : celui-ci est déjà l'élément lié ci-dessus.",
    );
  });

  it('takes another label, for the « Compte par défaut » setting', async () => {
    getNetWorth$.mockReturnValue(of(netWorthResponse(TICKET_ASSETS)));
    const fixture = await render(null, {
      labelKey: 'netWorth.account.defaultLabel',
    });

    expect(
      fixture.nativeElement.querySelector('mat-label').textContent.trim(),
    ).toBe('Compte par défaut');
  });
});

describe('injectInitialAccountId', () => {
  const postHog = createMockPostHogService();

  const initialAccountId = (isEnabled: boolean, defaultId: string | null) => {
    postHog.isFeatureEnabled.mockReturnValue(isEnabled);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PostHogService, useValue: postHog },
        {
          provide: UserSettingsStore,
          useValue: { defaultAccountId: () => defaultId },
        },
      ],
    });
    return TestBed.runInInjectionContext(injectInitialAccountId)();
  };

  it('CA3: starts on « Aucun » without a default account', () => {
    expect(initialAccountId(true, null)).toBeNull();
  });

  it('CA29: starts on the default account', () => {
    expect(initialAccountId(true, COMPTE_COURANT.id)).toBe(COMPTE_COURANT.id);
  });

  it('CA2: starts on « Aucun » with the flag off, whatever the default', () => {
    expect(initialAccountId(false, COMPTE_COURANT.id)).toBeNull();
  });
});
