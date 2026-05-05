import type { Page } from '@playwright/test';

export async function enableFeatureFlags(
  page: Page,
  flags: Record<string, boolean>,
): Promise<void> {
  await page.addInitScript((injected) => {
    (
      window as unknown as { __E2E_POSTHOG_FLAGS__: Record<string, boolean> }
    ).__E2E_POSTHOG_FLAGS__ = injected;
  }, flags);
}
