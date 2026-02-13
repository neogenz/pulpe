import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { AboutDialog } from './about-dialog';
import { ApplicationConfiguration } from '@core/config/application-configuration';

describe('AboutDialog', () => {
  let fixture: ComponentFixture<AboutDialog>;
  let component: AboutDialog;

  const mockDialogRef = { close: vi.fn() };
  const mockApplicationConfig = {
    environment: vi.fn().mockReturnValue('development'),
    supabaseUrl: vi.fn().mockReturnValue('https://supabase.example.com'),
    backendApiUrl: vi.fn().mockReturnValue('https://api.example.com'),
    postHog: vi.fn().mockReturnValue({ enabled: false, host: '' }),
  };

  beforeEach(async () => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      imports: [AboutDialog],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: ApplicationConfiguration, useValue: mockApplicationConfig },
      ],
    });

    fixture = TestBed.createComponent(AboutDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getSectionHeaders(): string[] {
    const headers: NodeListOf<Element> =
      fixture.nativeElement.querySelectorAll('h3');
    return Array.from(headers).map((h: Element) => h.textContent?.trim() ?? '');
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display only Build section and Liens utiles by default', () => {
    const headerTexts = getSectionHeaders();

    expect(headerTexts).toContain('Build');
    expect(headerTexts).toContain('Liens utiles');
    expect(headerTexts).not.toContain('Environnement');
    expect(headerTexts).not.toContain('Configuration');
    expect(headerTexts).not.toContain('Analytics');
  });

  it('should reveal debug sections after 10s long press on title', async () => {
    const title: HTMLElement = fixture.nativeElement.querySelector('h2');

    title.dispatchEvent(new MouseEvent('mousedown'));
    vi.advanceTimersByTime(10_000);
    fixture.detectChanges();
    await fixture.whenStable();

    const headerTexts = getSectionHeaders();

    expect(headerTexts).toContain('Environnement');
    expect(headerTexts).toContain('Configuration');
    expect(headerTexts).toContain('Analytics');
  });

  it('should not reveal debug sections if press is released before 10s', async () => {
    const title: HTMLElement = fixture.nativeElement.querySelector('h2');

    title.dispatchEvent(new MouseEvent('mousedown'));
    vi.advanceTimersByTime(5_000);
    title.dispatchEvent(new MouseEvent('mouseup'));
    vi.advanceTimersByTime(10_000);
    fixture.detectChanges();
    await fixture.whenStable();

    const headerTexts = getSectionHeaders();

    expect(headerTexts).not.toContain('Environnement');
  });

  it('should support touch events for long press', async () => {
    const title: HTMLElement = fixture.nativeElement.querySelector('h2');

    title.dispatchEvent(new TouchEvent('touchstart'));
    vi.advanceTimersByTime(10_000);
    fixture.detectChanges();
    await fixture.whenStable();

    const headerTexts = getSectionHeaders();

    expect(headerTexts).toContain('Environnement');
  });

  it('should display useful links section', () => {
    const headerTexts = getSectionHeaders();

    expect(headerTexts).toContain('Liens utiles');
  });

  it('should have a changelog link opening in new tab', () => {
    const links: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('a'),
    );
    const changelogLink = links.find((a) =>
      a.textContent?.includes('Nouveautés'),
    );

    expect(changelogLink).toBeTruthy();
    expect(changelogLink?.getAttribute('href')).toBe('/changelog');
    expect(changelogLink?.getAttribute('target')).toBe('_blank');
    expect(changelogLink?.getAttribute('rel')).toBe('noopener');
  });

  it('should have a link to CGU', () => {
    const links: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('a'),
    );
    const cguLink = links.find((a) =>
      a.textContent?.includes("Conditions Générales d'Utilisation"),
    );

    expect(cguLink).toBeTruthy();
  });

  it('should have a link to privacy policy', () => {
    const links: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('a'),
    );
    const privacyLink = links.find((a) =>
      a.textContent?.includes('Politique de Confidentialité'),
    );

    expect(privacyLink).toBeTruthy();
  });

  it('should close dialog when clicking a legal link', () => {
    const links: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('a'),
    );
    const cguLink = links.find((a) =>
      a.textContent?.includes("Conditions Générales d'Utilisation"),
    );

    cguLink?.click();
    fixture.detectChanges();

    expect(mockDialogRef.close).toHaveBeenCalled();
  });

  it('should close dialog when clicking the close button', () => {
    const closeButton = fixture.nativeElement.querySelector(
      '[data-testid="about-close-button"]',
    );

    closeButton.click();
    fixture.detectChanges();

    expect(mockDialogRef.close).toHaveBeenCalled();
  });
});
