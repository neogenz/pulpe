import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Mock Turnstile component for testing
 *
 * Simulates ngx-turnstile behavior without actual Cloudflare API calls.
 * Useful for unit tests and E2E tests.
 *
 * Usage in tests:
 * ```typescript
 * import { MockTurnstileComponent } from '@testing/turnstile-mock';
 *
 * TestBed.configureTestingModule({
 *   imports: [YourComponent, MockTurnstileComponent],
 * });
 * ```
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'ngx-turnstile',
  template: '',
  standalone: true,
})
export class MockTurnstileComponent {
  @Input() siteKey?: string;
  @Input() appearance?: 'always' | 'execute' | 'interaction-only';
  @Input() theme?: 'light' | 'dark' | 'auto';
  @Output() resolved = new EventEmitter<string>();
  @Output() errored = new EventEmitter<string | null>();

  /**
   * Simulates Turnstile widget reset
   * Automatically re-triggers challenge for interaction-only appearance
   */
  reset(): void {
    if (this.appearance === 'interaction-only') {
      // Simulate automatic re-challenge after reset
      setTimeout(() => {
        this.resolved.emit('XXXX.DUMMY.TOKEN.XXXX');
      }, 0);
    }
  }

  /**
   * Simulates Turnstile widget creation
   * Automatically resolves for interaction-only appearance
   */
  createWidget(): void {
    if (this.appearance === 'interaction-only') {
      setTimeout(() => {
        this.resolved.emit('XXXX.DUMMY.TOKEN.XXXX');
      }, 0);
    }
  }

  /**
   * Checks if Turnstile script is loaded
   * Always returns true in mock
   */
  scriptLoaded(): boolean {
    return true;
  }
}
