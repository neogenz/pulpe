import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let mockMql: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockMql = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue(mockMql as unknown as MediaQueryList),
    );

    document.documentElement.classList.remove('dark-theme');

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ThemeService],
    });

    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.classList.remove('dark-theme');
  });

  it('should default to light mode when OS prefers light', () => {
    expect(service.isDark()).toBe(false);
  });

  it('should default to dark mode when OS prefers dark', () => {
    TestBed.resetTestingModule();
    mockMql.matches = true;

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ThemeService],
    });

    const darkService = TestBed.inject(ThemeService);
    expect(darkService.isDark()).toBe(true);
  });

  it('should register a matchMedia change listener', () => {
    expect(mockMql.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });

  it('should remove the matchMedia listener on destroy', () => {
    TestBed.resetTestingModule();

    expect(mockMql.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });

  it('should toggle dark-theme class on documentElement', async () => {
    // GIVEN: light mode by default
    await TestBed.inject(ThemeService);
    TestBed.flushEffects();
    expect(document.documentElement.classList.contains('dark-theme')).toBe(
      false,
    );

    // WHEN: force dark
    service.forceTheme('dark');
    TestBed.flushEffects();

    // THEN: class applied
    expect(document.documentElement.classList.contains('dark-theme')).toBe(
      true,
    );
  });

  it('should allow forceTheme to override OS preference', () => {
    service.forceTheme('dark');
    expect(service.isDark()).toBe(true);

    service.forceTheme('light');
    expect(service.isDark()).toBe(false);

    service.forceTheme(null);
    expect(service.isDark()).toBe(false);
  });
});
