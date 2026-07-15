"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui";
import { angularUrl } from "@/lib/config";
import { trackCTAClick } from "@/lib/posthog";

const navLinks = [
  { href: "/#features", label: "Fonctionnalités" },
  { href: "/#how-it-works", label: "Comment ça marche" },
  { href: "/#platforms", label: "Applications" },
  { href: "/#why-free", label: "Pourquoi gratuit" },
];

const SCROLL_THRESHOLD = 20;
const THROTTLE_MS = 100;
const DESKTOP_BREAKPOINT_PX = 768;

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastScrollTime = useRef(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const now = Date.now();
      if (now - lastScrollTime.current < THROTTLE_MS) return;
      lastScrollTime.current = now;
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    <header className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2">
      <nav
        className={`relative flex items-center justify-between gap-3 rounded-full border border-white/80 px-4 py-2.5 backdrop-blur-xl transition-[background-color,box-shadow,scale,translate] duration-300 [transition-timing-function:var(--ease-smooth)] md:px-5 motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:scale-100 ${
          scrolled
            ? "-translate-y-0.5 scale-[0.985] bg-white/[0.92] shadow-[var(--shadow-liquid-glass)]"
            : "translate-y-0 scale-100 bg-white/[0.78] shadow-[var(--shadow-glass)]"
        }`}
        aria-label="Navigation principale"
      >
        <span
          className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
          aria-hidden="true"
        />

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

        <div className="relative z-10 hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium text-text-secondary transition-[color,background-color,scale] duration-200 hover:bg-primary/8 hover:text-primary active:scale-[0.96] active:bg-primary/12 motion-reduce:transition-none motion-reduce:scale-100"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <Button
            href={angularUrl("/signup", "header_commencer")}
            size="sm"
            className="shrink-0"
            onClick={() => trackCTAClick("commencer", "header", "/signup")}
          >
            Commencer
          </Button>

          <button
            ref={menuButtonRef}
            type="button"
            className="grid min-h-11 min-w-11 place-items-center rounded-full text-text-secondary transition-[color,background-color,scale] duration-200 hover:bg-primary/8 hover:text-text active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 md:hidden motion-reduce:transition-none motion-reduce:scale-100"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileMenuOpen}
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
        aria-label="Navigation mobile"
        className={`absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-[1.5rem] border border-white/80 bg-[#fffefa]/95 shadow-[var(--shadow-liquid-glass)] backdrop-blur-xl transition-[opacity,translate,scale] duration-250 [transition-timing-function:var(--ease-smooth)] md:hidden motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:transition-none ${
          mobileMenuOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-[0.98] opacity-0"
        }`}
        {...(!mobileMenuOpen && { inert: true })}
      >
        <div className="flex flex-col gap-1 p-3">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="min-h-11 rounded-xl px-4 py-3 text-base font-semibold text-text transition-[background-color,scale] duration-200 hover:bg-primary/8 active:scale-[0.96] active:bg-primary/12 motion-reduce:transition-none motion-reduce:scale-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
