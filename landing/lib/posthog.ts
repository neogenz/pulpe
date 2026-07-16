type PostHogClient = (typeof import("posthog-js/dist/module.slim"))["default"];

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ph";
const POSTHOG_UI_HOST = "https://eu.posthog.com";
const POSTHOG_ENABLED = process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "true";

export const CROSS_DOMAIN_PARAM = "ph_did";

const VERCEL_ENV_MAP: Record<string, string> = {
  production: "production",
  preview: "development",
  development: "development",
};

function resolveEnvironment(): string {
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  return vercelEnv ? (VERCEL_ENV_MAP[vercelEnv] ?? vercelEnv) : "local";
}

let posthogClient: PostHogClient | undefined;
let initialization: Promise<void> | undefined;

export function initPostHog(): Promise<void> | undefined {
  if (posthogClient) {
    return Promise.resolve();
  }
  if (!POSTHOG_ENABLED || !POSTHOG_KEY || typeof window === "undefined") {
    return undefined;
  }

  initialization ??= import("posthog-js/dist/module.slim")
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        ui_host: POSTHOG_UI_HOST,
        capture_pageview: true,
        capture_pageleave: true,
        person_profiles: "identified_only",
        persistence: "localStorage+cookie",
        cross_subdomain_cookie: true,
      });

      posthog.register({
        environment: resolveEnvironment(),
        platform: "landing",
      });

      posthogClient = posthog;
    })
    .catch((error: unknown) => {
      initialization = undefined;
      console.error("[PostHog] Failed to initialize", error);
    });

  return initialization;
}

export function trackCTAClick(
  ctaName: string,
  ctaLocation: string,
  destination: string,
): void {
  if (!POSTHOG_ENABLED) return;
  const initialization = initPostHog();
  if (!initialization) return;
  void initialization.then(() => {
    posthogClient?.capture("cta_clicked", {
      cta_name: ctaName,
      cta_location: ctaLocation,
      destination,
    });
  });
}

export function getDistinctId(): string | undefined {
  if (!POSTHOG_ENABLED || !posthogClient) return undefined;
  try {
    return posthogClient.get_distinct_id();
  } catch {
    return undefined;
  }
}
