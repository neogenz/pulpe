"use client";

import { useEffect } from "react";
import {
  initPostHog,
  getDistinctId,
  trackCTAClick,
  CROSS_DOMAIN_PARAM,
} from "../lib/posthog";
import { ANGULAR_APP_URL } from "../lib/config";

const POSTHOG_NAVIGATION_TIMEOUT_MS = 300;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initPostHog();

    const handleClick = async (e: MouseEvent) => {
      // Un écouteur délégué unique remplace les gestionnaires dispersés dans
      // les sections. Celles-ci n'étaient client que pour poser un `onClick`
      // de suivi : elles redeviennent statiques et quittent le bundle.
      const cta = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-cta-name]",
      );
      if (cta?.dataset.ctaName) {
        trackCTAClick(
          cta.dataset.ctaName,
          cta.dataset.ctaLocation ?? "",
          cta.dataset.ctaDestination ?? "",
        );
      }

      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (!link?.href || !ANGULAR_APP_URL) return;
      if (!link.href.startsWith(ANGULAR_APP_URL)) return;

      const initialization = initPostHog();
      if (!initialization) return;

      e.preventDefault();
      let timeoutId: number | undefined;
      await Promise.race([
        initialization,
        new Promise<void>((resolve) => {
          timeoutId = window.setTimeout(
            resolve,
            POSTHOG_NAVIGATION_TIMEOUT_MS,
          );
        }),
      ]);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      const distinctId = getDistinctId();
      const url = new URL(link.href);
      if (distinctId) {
        url.searchParams.set(CROSS_DOMAIN_PARAM, distinctId);
      }
      window.location.href = url.toString();
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return <>{children}</>;
}
