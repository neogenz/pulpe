"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui";
import {
  MOBILE_NAV_ID,
  MOBILE_NAV_PANEL_ID,
  SCROLL_SENTINEL_ID,
  angularUrl,
} from "@/lib/config";
import { trackCTAClick } from "@/lib/posthog";

const navLinks = [
  { href: "/#pain-points", label: "Pourquoi Pulpe" },
  { href: "/#how-it-works", label: "Comment ça marche" },
  { href: "/#platforms", label: "Applications" },
  { href: "/#why-free", label: "Pourquoi c’est gratuit" },
];

const SCROLL_THRESHOLD_PX = 20;

export function Header() {
  return (
    <>
      {/* Rendue côté serveur : le script inline du layout l'observe dès la fin du
          parsing, sans attendre React. */}
      <div
        id={SCROLL_SENTINEL_ID}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 w-px"
        style={{ height: SCROLL_THRESHOLD_PX }}
      />
      <header className="fixed inset-x-2.5 top-2.5 z-50">
        <nav
          // `backdrop-filter` est volontairement hors de la transition : Safari
          // interpolerait le rayon de flou sur 500 ms, plein écran, au moment
          // précis où le défilement démarre. Les deux états gardent leur flou,
          // seul le fondu du rayon disparaît — et il était de toute façon
          // masqué par le fond qui se fond sur la même durée.
          className="relative z-20 flex h-14 items-center justify-between gap-3 rounded-2xl bg-white/40 px-6 shadow-none ring-1 ring-transparent backdrop-blur-none transition-[background-color,box-shadow] duration-500 scrolled:bg-surface/80 scrolled:shadow-[0_4px_30px_rgba(0,0,0,0.1)] scrolled:ring-white/60 scrolled:backdrop-blur-[14px] scrolled:backdrop-saturate-150 lg:h-[72px] motion-reduce:transition-none"
          aria-label="Navigation principale"
        >
          <Link
            href="/"
            className="relative z-10 flex min-h-11 items-center gap-2 font-bold text-lg text-text"
            aria-label="Pulpe, accueil"
          >
            <Image
              src="/icon-64.webp"
              alt=""
              aria-hidden="true"
              width={28}
              height={28}
              className="h-7 w-7"
            />
            <span>Pulpe</span>
          </Link>

          <div className="relative z-10 hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium text-text transition-[color,background-color,scale] duration-200 hover:bg-primary/8 hover:text-primary active:scale-[0.96] active:bg-primary/12 motion-reduce:transition-none motion-reduce:scale-100"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="relative z-10 flex items-center gap-2">
            <div className="hidden lg:block">
              <Button
                href={angularUrl("/signup", "header_commencer")}
                size="sm"
                className="shrink-0"
                onClick={() => trackCTAClick("commencer", "header", "/signup")}
              >
                Créer mon budget
              </Button>
            </div>

          </div>
        </nav>

        {/* `<details>` porte nativement l'état ouvert, la commande clavier et
            l'annonce lecteur d'écran, et répond dès le premier affichage : le
            menu n'attend plus l'hydratation, mesurée à 3,2 s sur mobile.
            Il reste hors du `<nav>` de la barre parce que celui-ci porte un
            `backdrop-filter` en état scrollé, ce qui en ferait un bloc
            conteneur et casserait le `fixed inset-0` du panneau. */}
        <details id={MOBILE_NAV_ID} className="group">
          <summary
            aria-label="Menu"
            className="absolute right-6 top-0 z-30 grid h-14 min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-lg text-text-secondary transition-[color,background-color,scale] duration-200 hover:bg-primary/8 hover:text-text active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 lg:hidden motion-reduce:transition-none motion-reduce:scale-100 [&::-webkit-details-marker]:hidden"
          >
            {/* `blur-none` et non `blur-0` : cette dernière est une classe
                Tailwind v3, que la v4 ne génère plus. Elle échouait en silence
                et laissait la croix floutée à 4px une fois le menu ouvert. */}
            <span className="relative block h-6 w-6" aria-hidden="true">
              <Menu className="absolute inset-0 scale-100 opacity-100 blur-none transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] group-open:scale-[0.25] group-open:opacity-0 group-open:blur-[4px] motion-reduce:transition-none motion-reduce:blur-none" />
              <X className="absolute inset-0 scale-[0.25] opacity-0 blur-[4px] transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] group-open:scale-100 group-open:opacity-100 group-open:blur-none motion-reduce:transition-none motion-reduce:blur-none" />
            </span>
          </summary>

          {/* Le panneau reste affiché pour conserver son fondu : le
              `display: none` natif d'un `<details>` replié ne se transitionne
              pas. `invisible` le retire alors de l'arbre d'accessibilité et du
              parcours de tabulation, ce que faisait l'ancien `inert`. */}
          <nav
            id={MOBILE_NAV_PANEL_ID}
            aria-label="Navigation mobile"
            className="invisible fixed inset-0 z-10 flex items-center overflow-y-auto bg-surface/95 p-4 pt-24 opacity-0 backdrop-blur-xl transition-[opacity,visibility] duration-300 group-open:visible group-open:opacity-100 lg:hidden motion-reduce:transition-none"
          >
            <div className="flex w-full flex-col gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex min-h-14 items-center justify-center rounded-lg px-4 py-3 text-center text-lg font-semibold text-text transition-[background-color,scale] duration-200 hover:bg-primary/8 active:scale-[0.96] active:bg-primary/12 motion-reduce:transition-none motion-reduce:scale-100"
                >
                  {link.label}
                </a>
              ))}
              <Button
                href={angularUrl("/signup", "mobile_menu_commencer")}
                className="mt-4 w-full"
                onClick={() =>
                  trackCTAClick("commencer", "mobile_menu", "/signup")
                }
              >
                Créer mon budget
              </Button>
            </div>
          </nav>
        </details>
      </header>
    </>
  );
}
