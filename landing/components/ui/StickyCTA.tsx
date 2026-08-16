"use client";

import { useEffect, useState } from "react";
import { Button } from "./Button";
import { angularUrl } from "@/lib/config";
import type { Locale } from "@/lib/i18n";

/**
 * Persistent CTA below the desktop header breakpoint: appears once the hero
 * has scrolled out of view and steps aside when the final CTA is on screen.
 * Shown up to `lg` because the header's own CTA only appears at `lg` —
 * without it, tablets (768–1023px) would have no persistent way to sign up.
 * Hidden with visibility (not just opacity) so it never grabs focus or taps.
 * The opaque shell is load-bearing, not decoration: the bar travels over
 * `#platforms`, whose card is `bg-primary`, and a bare green button on green
 * loses its boundary entirely.
 */
export function StickyCTA({
  label,
  locale,
}: {
  label: string;
  locale: Locale;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
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
      // Pleine largeur sur téléphone, où la barre est la cible du pouce. Au-delà
      // de 640px elle se resserre en pastille centrée : sur une tablette, 736px
      // de capsule pour un libellé de 250px lisaient comme un chrome d'app
      // mobile posé sur une page qui a la place d'un bouton.
      className={`fixed inset-x-4 z-40 transition-[opacity,transform,visibility] duration-300 motion-reduce:transition-none sm:mx-auto sm:max-w-sm lg:hidden ${
        visible
          ? "translate-y-0 opacity-100"
          : "invisible translate-y-4 opacity-0"
      }`}
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="rounded-full bg-surface p-1.5 shadow-glass">
        <Button
          href={angularUrl("/signup", "sticky_cta_commencer", locale)}
          glow
          className="w-full"
          data-cta-name="commencer"
          data-cta-location="sticky_cta"
          data-cta-destination="/signup"
          tabIndex={visible ? undefined : -1}
        >
          {label}
        </Button>
      </div>
    </div>
  );
}
