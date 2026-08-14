import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";
import { MOBILE_NAV_ID, MOBILE_NAV_PANEL_ID, angularUrl } from "@/lib/config";
import type { Locale } from "@/lib/i18n";
import { localizedPath } from "@/lib/routes";

// La destination est structurelle et reste ici ; seul le libellé change de
// langue. L'ordre du tableau est l'ordre affiché.
const NAV_ITEMS = [
  { id: "painPoints", href: "/#pain-points" },
  { id: "howItWorks", href: "/#how-it-works" },
  { id: "platforms", href: "/#platforms" },
  { id: "support", href: "/support" },
  { id: "whyFree", href: "/#why-free" },
] as const satisfies readonly {
  id: keyof Dictionary["header"]["nav"];
  href: string;
}[];

export function Header({
  dict,
  locale,
}: {
  dict: Dictionary["header"];
  locale: Locale;
}) {
  const navLinks = NAV_ITEMS.map((item) => ({
    href: localizedPath(locale, item.href),
    label: dict.nav[item.id],
  }));
  const homeHref = localizedPath(locale, "/");

  return (
    <>
      <header className="fixed left-[calc(env(safe-area-inset-left)+0.625rem)] right-[calc(env(safe-area-inset-right)+0.625rem)] top-[calc(env(safe-area-inset-top)+0.625rem)] z-50">
        <nav
          // `backdrop-filter` est volontairement hors de la transition : Safari
          // interpolerait le rayon de flou sur 500 ms, plein écran, au moment
          // précis où le défilement démarre. Les deux états gardent leur flou,
          // seul le fondu du rayon disparaît — et il était de toute façon
          // masqué par le fond qui se fond sur la même durée.
          className="relative z-20 flex h-14 items-center justify-between gap-3 rounded-2xl bg-white/40 px-6 shadow-none ring-1 ring-transparent backdrop-blur-none transition-[background-color,box-shadow] duration-500 scrolled:bg-surface/80 scrolled:shadow-[0_4px_30px_rgba(0,0,0,0.1)] scrolled:ring-white/60 scrolled:backdrop-blur-[14px] scrolled:backdrop-saturate-150 lg:h-[72px] motion-reduce:transition-none"
          aria-label={dict.navAriaLabel}
        >
          <Link
            href={homeHref}
            className="relative z-10 flex min-h-11 items-center gap-2 font-bold text-lg text-text"
            aria-label={dict.homeAriaLabel}
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
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium text-text transition-[color,background-color,scale] duration-200 hover:bg-primary/8 hover:text-primary active:scale-[0.96] active:bg-primary/12 motion-reduce:transition-none motion-reduce:scale-100"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="relative z-10 flex items-center gap-2">
            <div className="hidden lg:block">
              <Button
                href={angularUrl("/signup", "header_commencer")}
                size="sm"
                className="shrink-0"
                data-cta-name="commencer"
                data-cta-location="header"
                data-cta-destination="/signup"
              >
                {dict.cta}
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
        <details id={MOBILE_NAV_ID} className="group peer">
          <summary
            aria-label={dict.menuLabel}
            aria-controls={MOBILE_NAV_PANEL_ID}
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
        </details>

        {/* Hors du `<details>` parce que le `<nav>` de la barre porte un
            `backdrop-filter` en état scrollé. Replié, le panneau sort de l'arbre
            de rendu (`display: none`) : Safari 26 teinte sa barre du bas avec le
            fond d'un élément fixe qui l'atteint, et `opacity: 0` ne suffit pas à
            l'en soustraire — le bouton vert du menu, ancré en bas, lui donnait
            son aplat sur toute la landing. La bascule de `display` s'anime
            comme le reste : `allow-discrete` la retient le temps du fondu, et
            `@starting-style` donne à l'ouverture son opacité de départ.
            L'ouverture est bornée à `max-lg` : son sélecteur pèse plus lourd
            que `lg:hidden`, qui ne la rattraperait pas sur un écran large.
            `inert` retire ses liens du clavier et de l'arbre d'accessibilité ;
            le script couvre les navigateurs qui l'ignorent encore. */}
        <nav
          id={MOBILE_NAV_PANEL_ID}
          aria-label={dict.mobileNavAriaLabel}
          aria-hidden="true"
          inert
          className="pointer-events-none fixed inset-x-0 top-0 z-10 hidden h-screen overflow-y-auto bg-surface pt-24 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] opacity-0 transition-[opacity,display] transition-discrete duration-300 peer-open:pointer-events-auto peer-open:opacity-100 peer-open:starting:opacity-0 max-lg:peer-open:flex lg:hidden motion-reduce:transition-none"
        >
          {/* Les liens s'ancrent sous la barre, le CTA au bas de l'écran, à
              portée de pouce. Centré, le bloc flottait au milieu d'un plein
              écran opaque avec ~300px de vide au-dessus et ~200px en dessous. */}
          <div className="flex h-full w-full flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                tabIndex={-1}
                className="flex min-h-14 items-center justify-center rounded-lg px-4 py-3 text-center text-lg font-semibold text-text transition-[background-color,scale] duration-200 hover:bg-primary/8 active:scale-[0.96] active:bg-primary/12 motion-reduce:transition-none motion-reduce:scale-100"
              >
                {link.label}
              </Link>
            ))}
            <Button
              href={angularUrl("/signup", "mobile_menu_commencer")}
              tabIndex={-1}
              className="mt-auto w-full"
              data-cta-name="commencer"
              data-cta-location="mobile_menu"
              data-cta-destination="/signup"
            >
              {dict.cta}
            </Button>
          </div>
        </nav>
      </header>
    </>
  );
}
