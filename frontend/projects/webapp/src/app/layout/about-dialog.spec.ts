import { describe, expect, it, vi } from 'vitest';
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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display debug info sections', () => {
    const sectionHeaders: NodeListOf<Element> =
      fixture.nativeElement.querySelectorAll('h3');
    const headerTexts = Array.from(sectionHeaders).map((h: Element) =>
      h.textContent?.trim(),
    );

    expect(headerTexts).toContain('Build');
    expect(headerTexts).toContain('Environnement');
    expect(headerTexts).toContain('Configuration');
    expect(headerTexts).toContain('Analytics');
  });

  it('should display legal section with links', () => {
    const sectionHeaders: NodeListOf<Element> =
      fixture.nativeElement.querySelectorAll('h3');
    const headerTexts = Array.from(sectionHeaders).map((h: Element) =>
      h.textContent?.trim(),
    );

    expect(headerTexts).toContain('Mentions légales');
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
