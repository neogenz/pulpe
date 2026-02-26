import { Injectable, computed, effect, signal } from '@angular/core';

const DARK_THEME_CLASS = 'dark-theme';
const OS_DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Manages the `.dark-theme` class on the document root.
 *
 * By default, follows the OS preference via `matchMedia`.
 * The design system page (dev-only) can temporarily force light/dark
 * via `forceTheme()` for visual testing.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly #osPrefersDark = signal(matchMedia(OS_DARK_QUERY).matches);
  readonly #override = signal<'light' | 'dark' | null>(null);

  readonly isDark = computed(() => {
    const override = this.#override();
    if (override !== null) return override === 'dark';
    return this.#osPrefersDark();
  });

  constructor() {
    matchMedia(OS_DARK_QUERY).addEventListener('change', (e) => {
      this.#osPrefersDark.set(e.matches);
    });

    effect(() => {
      document.documentElement.classList.toggle(
        DARK_THEME_CLASS,
        this.isDark(),
      );
    });
  }

  forceTheme(theme: 'light' | 'dark' | null): void {
    this.#override.set(theme);
  }
}
