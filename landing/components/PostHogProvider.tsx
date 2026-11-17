"use client";

import { useEffect } from "react";
import {
  ANGULAR_APP_URL,
  appStoreCampaignUrl,
  IOS_APP_URL,
} from "../lib/config";
import { initPostHog, trackCTAClick } from "../lib/posthog";
import type { Locale } from "../lib/i18n";

const APP_STORE_ORIGIN = new URL(IOS_APP_URL).origin;
// Read once, at first load: client navigation drops the arrival query string.
const landingCampaign =
  typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get("utm_campaign");

export function PostHogProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  useEffect(() => {
    void initPostHog(locale);

    const handleClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const cta = e.target.closest<HTMLElement>("[data-cta-name]");
      const ctaName = cta?.dataset.ctaName;
      if (!ctaName) return;

      const tracking = () =>
        trackCTAClick(
          ctaName,
          cta.dataset.ctaLocation ?? "",
          cta.dataset.ctaDestination ?? "",
        );
      const anchor = cta.closest<HTMLAnchorElement>("a[href]");
      // Set here, not in the markup: the page is prerendered, and the campaign
      // comes from this visitor's arrival URL. The browser follows the href as
      // it stands after this listener.
      if (anchor && new URL(anchor.href).origin === APP_STORE_ORIGIN) {
        anchor.href = appStoreCampaignUrl(landingCampaign);
      }
      // Leaving for either destination can unload the page before the event
      // is sent, so the click waits for tracking (300 ms at most).
      const trackedOrigins = [APP_STORE_ORIGIN];
      if (ANGULAR_APP_URL) {
        trackedOrigins.push(
          new URL(ANGULAR_APP_URL, window.location.href).origin,
        );
      }
      const shouldWaitForTracking =
        anchor &&
        trackedOrigins.includes(new URL(anchor.href).origin) &&
        e.button === 0 &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        !e.defaultPrevented &&
        !anchor.download &&
        (!anchor.target || anchor.target === "_self");

      if (!shouldWaitForTracking) {
        void tracking();
        return;
      }

      const href = anchor.href;
      e.preventDefault();
      void tracking().finally(() => window.location.assign(href));
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [locale]);

  return <>{children}</>;
}
