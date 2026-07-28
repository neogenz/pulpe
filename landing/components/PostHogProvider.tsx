"use client";

import { useEffect } from "react";
import { initPostHog, trackCTAClick } from "../lib/posthog";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initPostHog();

    const handleClick = (e: MouseEvent) => {
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
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return <>{children}</>;
}
