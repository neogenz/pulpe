import type { ReactNode } from "react";
import { Poppins } from "next/font/google";
import { PostHogProvider } from "./PostHogProvider";
import {
  DESKTOP_BREAKPOINT_PX,
  MOBILE_NAV_ID,
  MOBILE_NAV_PANEL_ID,
  ORGANIZATION_ID,
  SCROLL_SENTINEL_ID,
} from "@/lib/config";
import type { Locale } from "@/lib/i18n";
import { OPEN_GRAPH_LOCALE, SITE_URL } from "@/lib/routes";

const SCROLL_THRESHOLD_PX = 20;

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: "normal",
  display: "swap",
  variable: "--font-poppins",
});

// L'en-tête vit hors de React : le bundle applicatif arrive plusieurs secondes
// après la peinture sur mobile, et un `useEffect` laisserait la navbar
// transparente et le menu inerte pendant tout ce temps. L'ouverture du menu est
// native (`<details>`) ; ce script ne fournit que ce que le navigateur ne fait
// pas seul, et pose l'attribut de défilement sur `<html>` avant l'hydratation.
// Cet écart attendu est ignoré directement sur l'élément racine.
// L'en-tête est reconstruit à chaque navigation client, donc aucun écouteur ne
// s'attache à ses éléments : tout est délégué au document, qui redemande
// l'élément à chaque événement. `toggle` ne remonte pas, il est donc capturé.
const headerScript = `(function(){
if(window.pulpeHeaderReady)return;
window.pulpeHeaderReady=1;
function nav(){return document.getElementById('${MOBILE_NAV_ID}');}
function close(){var n=nav();if(n&&n.open)n.open=false;}
function syncPanel(){
var panel=document.getElementById('${MOBILE_NAV_PANEL_ID}');
if(!panel)return;
var n=nav();
var closed=!(n&&n.open);
panel.inert=closed;
if(closed)panel.setAttribute('aria-hidden','true');
else panel.removeAttribute('aria-hidden');
var links=panel.querySelectorAll('a');
for(var i=0;i<links.length;i++){
if(closed)links[i].setAttribute('tabindex','-1');
else links[i].removeAttribute('tabindex');
}
}
document.addEventListener('toggle',function(e){
if(e.target&&e.target.id==='${MOBILE_NAV_ID}')syncPanel();
},true);
document.addEventListener('click',function(e){
var t=e.target;
if(t&&t.closest&&t.closest('#${MOBILE_NAV_PANEL_ID} a'))close();
});
document.addEventListener('keydown',function(e){
if(e.key!=='Escape')return;
var n=nav();
if(!n||!n.open)return;
n.open=false;
var summary=n.querySelector('summary');
if(summary)summary.focus({preventScroll:true});
});
window.addEventListener('scroll',close,{passive:true});
window.addEventListener('resize',function(){
if(window.innerWidth>=${DESKTOP_BREAKPOINT_PX})close();
});
function start(){
var sentinel=document.getElementById('${SCROLL_SENTINEL_ID}');
if(sentinel&&window.IntersectionObserver){
new IntersectionObserver(function(entries){
document.documentElement.toggleAttribute('data-scrolled',!entries[0].isIntersecting);
}).observe(sentinel);
}
syncPanel();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
else start();
})();`;

function buildJsonLd(locale: Locale, description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        // Entité unique : les articles de /conseils-budget référencent son
        // `@id` comme éditeur au lieu de la redéclarer.
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "Pulpe",
        url: SITE_URL,
        logo: `${SITE_URL}/icon-192.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "Pulpe",
        alternateName: ["pulpe", "Pulpe app", "pulpe.app"],
        description,
        inLanguage: OPEN_GRAPH_LOCALE[locale].replace("_", "-"),
        publisher: { "@id": ORGANIZATION_ID },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: "Pulpe",
        description,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web, iOS",
        author: { "@id": ORGANIZATION_ID },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "CHF",
        },
      },
    ],
  };
}

/**
 * Le document complet, partagé par les deux root layouts.
 *
 * `app/(fr)/layout.tsx` et `app/[lang]/layout.tsx` sont deux racines
 * indépendantes : sous `output: 'export'` il n'existe ni middleware ni rewrite,
 * et c'est la seule forme qui garde le français à `/`. Chacune doit donc monter
 * pour son compte tout ce qui est global — la police, `globals.css`, le script
 * d'en-tête, `PostHogProvider`. Un fournisseur monté d'un seul côté échouerait
 * en silence pour les trois autres langues ; ce composant est ce qui empêche
 * les deux racines de diverger.
 */
export function RootDocument({
  locale,
  graphDescription,
  children,
}: {
  locale: Locale;
  graphDescription: string;
  children: ReactNode;
}) {
  const jsonLd = buildJsonLd(locale, graphDescription);

  return (
    <html lang={locale} className={poppins.variable} suppressHydrationWarning>
      {/* Ce document est un root layout : `<head>` y est la bonne balise. La
          règle ne reconnaît l'App Router qu'au chemin du fichier, et celui-ci
          vit dans `components/`. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: headerScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body className="font-sans antialiased">
        {/* Rendue par le document et jamais recréée par une navigation client,
            pour que l'IntersectionObserver posé au premier chargement survive. */}
        <div
          id={SCROLL_SENTINEL_ID}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 w-px"
          style={{ height: SCROLL_THRESHOLD_PX }}
        />
        <PostHogProvider>{children}</PostHogProvider>
        <div id="lightbox-root" />
      </body>
    </html>
  );
}
