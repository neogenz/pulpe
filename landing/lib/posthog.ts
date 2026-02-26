import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
const POSTHOG_ENABLED = process.env.NEXT_PUBLIC_POSTHOG_ENABLED === 'true';

let initialized = false;

export function initPostHog(): void {
  if (initialized || !POSTHOG_ENABLED || !POSTHOG_KEY || typeof window === 'undefined') return;

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: true,
      person_profiles: 'identified_only',
      persistence: 'localStorage+cookie',
    });

    initialized = true;
  } catch (error) {
    console.error('[PostHog] Failed to initialize', error);
  }
}

export function trackCTAClick(ctaName: string, ctaLocation: string, destination: string): void {
  if (!initialized) return;
  posthog.capture('cta_clicked', { cta_name: ctaName, cta_location: ctaLocation, destination });
}
