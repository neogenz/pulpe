import type { PostHog } from "posthog-js/dist/module.slim";
import { DEFAULT_LOCALE, type Locale } from "./i18n";

type PostHogClient = Pick<PostHog, "capture" | "register">;
type PostHogLoader = () => Promise<{ default: PostHog }>;

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ph";
const POSTHOG_UI_HOST = "https://eu.posthog.com";
const POSTHOG_ENABLED = process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "true";
const POSTHOG_PERSISTENCE_NAME = "pulpe_landing";
const CTA_TRACKING_TIMEOUT_MS = 300;

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
let activeLocale: Locale = DEFAULT_LOCALE;

function expireLegacySharedCookie(): void {
  const expiredCookie = `ph_${POSTHOG_KEY}_posthog=; Max-Age=0; Path=/; SameSite=Lax`;
  window.document.cookie = expiredCookie;
  if (
    window.location.hostname === "pulpe.app" ||
    window.location.hostname.endsWith(".pulpe.app")
  ) {
    window.document.cookie = `${expiredCookie}; Domain=.pulpe.app`;
  }
}

export function initPostHog(
  locale: Locale = activeLocale,
  loadPostHog: PostHogLoader = () => import("posthog-js/dist/module.slim"),
): Promise<void> | undefined {
  activeLocale = locale;
  if (posthogClient) {
    posthogClient.register({ locale });
    return Promise.resolve();
  }
  if (!POSTHOG_ENABLED || !POSTHOG_KEY || typeof window === "undefined") {
    return undefined;
  }

  expireLegacySharedCookie();
  initialization ??= loadPostHog()
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        ui_host: POSTHOG_UI_HOST,
        capture_pageview: true,
        capture_pageleave: true,
        person_profiles: "identified_only",
        persistence: "localStorage+cookie",
        persistence_name: POSTHOG_PERSISTENCE_NAME,
        cross_subdomain_cookie: false,
      });

      posthog.register({
        environment: resolveEnvironment(),
        locale: activeLocale,
        platform: "landing",
      });

      posthogClient = posthog;
    })
    .catch(() => {
      initialization = undefined;
      console.error("[PostHog] Failed to initialize");
    });

  return initialization;
}

export async function trackCTAClick(
  ctaName: string,
  ctaLocation: string,
  destination: string,
): Promise<void> {
  if (!POSTHOG_ENABLED) return;
  const initPromise = initPostHog();
  if (!initPromise) return;

  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, CTA_TRACKING_TIMEOUT_MS);
    void initPromise.finally(() => {
      window.clearTimeout(timeout);
      resolve();
    });
  });

  try {
    posthogClient?.capture(
      "cta_clicked",
      {
        cta_name: ctaName,
        cta_location: ctaLocation,
        destination,
      },
      {
        send_instantly: true,
        transport: "sendBeacon",
      },
    );
  } catch {
    console.error("[PostHog] Failed to capture CTA");
  }
}
