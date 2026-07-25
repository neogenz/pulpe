"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui";
import { SCROLL_SENTINEL_ID, angularUrl } from "@/lib/config";
import { trackCTAClick } from "@/lib/posthog";

const navLinks = [
  { href: "/#pain-points", label: "Pourquoi Pulpe" },
  { href: "/#how-it-works", label: "Comment ça marche" },
  { href: "/#platforms", label: "Applications" },
  { href: "/#why-free", label: "Pourquoi c’est gratuit" },
];

const SCROLL_THRESHOLD_PX = 20;
const DESKTOP_BREAKPOINT_PX = 1024;

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const closeOnDesktop = () => {
      if (window.innerWidth >= DESKTOP_BREAKPOINT_PX) {
        setMobileMenuOpen(false);
      }
    };
    const closeOnScroll = () => setMobileMenuOpen(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus({ preventScroll: true });
      }
    };

    window.addEventListener("resize", closeOnDesktop);
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", closeOnDesktop);
      window.removeEventListener("scroll", closeOnScroll);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

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

            <button
              ref={menuButtonRef}
              type="button"
              className="grid min-h-11 min-w-11 place-items-center rounded-lg text-text-secondary transition-[color,background-color,scale] duration-200 hover:bg-primary/8 hover:text-text active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 lg:hidden motion-reduce:transition-none motion-reduce:scale-100"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-panel"
            >
              <span className="relative block h-6 w-6" aria-hidden="true">
                <Menu
                  className={`absolute inset-0 transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none motion-reduce:blur-none ${
                    mobileMenuOpen
                      ? "scale-[0.25] opacity-0 blur-[4px]"
                      : "scale-100 opacity-100 blur-0"
                  }`}
                />
                <X
                  className={`absolute inset-0 transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none motion-reduce:blur-none ${
                    mobileMenuOpen
                      ? "scale-100 opacity-100 blur-0"
                      : "scale-[0.25] opacity-0 blur-[4px]"
                  }`}
                />
              </span>
            </button>
          </div>
        </nav>

        <nav
          id="mobile-nav-panel"
          aria-label="Navigation mobile"
          className={`fixed inset-0 z-10 flex items-center overflow-y-auto bg-surface/95 p-4 pt-24 backdrop-blur-xl transition-opacity duration-300 lg:hidden motion-reduce:transition-none ${
            mobileMenuOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          {...(!mobileMenuOpen && { inert: true })}
        >
          <div className="flex w-full flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex min-h-14 items-center justify-center rounded-lg px-4 py-3 text-center text-lg font-semibold text-text transition-[background-color,scale] duration-200 hover:bg-primary/8 active:scale-[0.96] active:bg-primary/12 motion-reduce:transition-none motion-reduce:scale-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Button
              href={angularUrl("/signup", "mobile_menu_commencer")}
              className="mt-4 w-full"
              onClick={() => {
                setMobileMenuOpen(false);
                trackCTAClick("commencer", "mobile_menu", "/signup");
              }}
            >
              Créer mon budget
            </Button>
          </div>
        </nav>
      </header>
    </>
  );
}
