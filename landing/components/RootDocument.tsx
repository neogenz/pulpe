import type { ReactNode } from "react";
import { Poppins } from "next/font/google";
import { PostHogProvider } from "./PostHogProvider";
import {
  DESKTOP_BREAKPOINT_PX,
  CONTACT_EMAIL,
  GITHUB_URL,
  IOS_APP_URL,
  MOBILE_NAV_ID,
  MOBILE_NAV_PANEL_ID,
  ORGANIZATION_ID,
  SCROLL_SENTINEL_ID,
} from "@/lib/config";
import { LOCALES, type Locale } from "@/lib/i18n";
import { OPEN_GRAPH_LOCALE, SITE_URL } from "@/lib/routes";

const SCROLL_THRESHOLD_PX = 20;

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: "normal",
  display: "swap",
  variable: "--font-poppins",
});

// The header runs outside React because the application bundle can arrive
// several seconds after first paint on mobile. A `useEffect` would leave the
// navbar transparent and the menu inert in the meantime. Menu disclosure is
// native (`<details>`); this script only supplies missing browser behavior and
// sets the scroll attribute on `<html>` before hydration. The expected mismatch
// is suppressed on the root element. Client navigation rebuilds the header, so
// listeners are delegated to the document and look up elements per event.
// `toggle` does not bubble and is therefore captured.
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

export function buildJsonLd(
  locale: Locale,
  description: string,
  featureList: readonly string[],
) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        // Single entity: /conseils-budget articles reference its `@id` as the
        // publisher instead of declaring it again.
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "Pulpe",
        url: SITE_URL,
        logo: `${SITE_URL}/icon-192.png`,
        contactPoint: {
          "@type": "ContactPoint",
          email: CONTACT_EMAIL,
          contactType: "customer support",
          url: `${SITE_URL}/support`,
          availableLanguage: [...LOCALES],
        },
        address: {
          "@type": "PostalAddress",
          addressCountry: "CH",
        },
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
        url: SITE_URL,
        description,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web, iOS",
        availableLanguage: [...LOCALES],
        countriesSupported: ["FR", "CH"],
        sameAs: [GITHUB_URL, IOS_APP_URL],
        downloadUrl: IOS_APP_URL,
        featureList: [...featureList],
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
 * Complete document shared by both root layouts.
 *
 * `app/(fr)/layout.tsx` and `app/[lang]/layout.tsx` are independent roots so
 * French can remain at `/`. Each must mount every global concern—the font,
 * `globals.css`, header script, and `PostHogProvider`. A provider mounted in
 * only one root would silently disappear from the other three languages; this
 * component keeps both roots aligned.
 */
export function RootDocument({
  locale,
  graphDescription,
  featureList,
  children,
}: {
  locale: Locale;
  graphDescription: string;
  featureList: readonly string[];
  children: ReactNode;
}) {
  const jsonLd = buildJsonLd(locale, graphDescription, featureList);

  return (
    <html lang={locale} className={poppins.variable} suppressHydrationWarning>
      {/* This document is a root layout, so `<head>` is the correct element.
          The rule detects the App Router from the file path, while this shared
          component lives under `components/`. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <link rel="describedby" href="/llms.txt" />
        <script dangerouslySetInnerHTML={{ __html: headerScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body className="font-sans antialiased">
        {/* Rendered by the document and never recreated by client navigation,
            so the IntersectionObserver installed on first load survives. */}
        <div
          id={SCROLL_SENTINEL_ID}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 w-px"
          style={{ height: SCROLL_THRESHOLD_PX }}
        />
        <PostHogProvider locale={locale}>{children}</PostHogProvider>
        <div id="lightbox-root" />
      </body>
    </html>
  );
}
