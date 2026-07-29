"use client";

import { useEffect } from "react";
import { ANGULAR_APP_URL } from "../lib/config";
import { initPostHog, trackCTAClick } from "../lib/posthog";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initPostHog();

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
      const appOrigin = ANGULAR_APP_URL
        ? new URL(ANGULAR_APP_URL, window.location.href).origin
        : undefined;
      const shouldWaitForTracking =
        anchor &&
        appOrigin &&
        new URL(anchor.href).origin === appOrigin &&
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
  }, []);

  return <>{children}</>;
}
