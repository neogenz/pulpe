"use client";

import { useEffect, useState } from "react";
import { Button } from "./Button";
import { angularUrl } from "@/lib/config";
import { trackCTAClick } from "@/lib/posthog";

/**
 * Mobile-only persistent CTA in the thumb zone: appears once the hero has
 * scrolled out of view and steps aside when the final CTA is on screen.
 * Hidden with visibility (not just opacity) so it never grabs focus or taps.
 */
export function StickyCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.querySelector(".hero-mesh");
    const finalCta = document.getElementById("final-cta");
    if (!hero) return;

    let heroVisible = true;
    let finalVisible = false;
    const update = () => setVisible(!heroVisible && !finalVisible);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === hero) heroVisible = entry.isIntersecting;
          else finalVisible = entry.isIntersecting;
        }
        update();
      },
      { threshold: 0 },
    );

    observer.observe(hero);
    if (finalCta) observer.observe(finalCta);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`fixed inset-x-4 z-40 transition-[opacity,transform,visibility] duration-300 motion-reduce:transition-none md:hidden ${
        visible
          ? "translate-y-0 opacity-100"
          : "invisible translate-y-4 opacity-0"
      }`}
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <Button
        href={angularUrl("/signup", "sticky_cta_commencer")}
        glow
        className="w-full shadow-[0_8px_30px_rgba(0,110,37,0.35)]"
        onClick={() => trackCTAClick("commencer", "sticky_cta", "/signup")}
        tabIndex={visible ? undefined : -1}
      >
        Créer mon budget gratuitement
      </Button>
    </div>
  );
}
