import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { PostHogProvider } from "../components/PostHogProvider";
import {
  DESKTOP_BREAKPOINT_PX,
  MOBILE_NAV_ID,
  MOBILE_NAV_PANEL_ID,
  ORGANIZATION_ID,
  SCROLL_SENTINEL_ID,
  SITE_URL,
  SOCIAL_PREVIEW_ALT,
  SOCIAL_PREVIEW_IMAGE,
} from "../lib/config";
import "./globals.css";

const SCROLL_THRESHOLD_PX = 20;

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: "normal",
  display: "swap",
  variable: "--font-poppins",
});

const SOCIAL_DESCRIPTION =
  "Planifie tes revenus, tes dépenses et ton épargne. Pulpe te montre combien il te restera chaque mois, sans connexion bancaire.";

export const metadata: Metadata = {
  metadataBase: new URL("https://pulpe.app"),
  title: {
    template: "%s | Pulpe",
    default: "Pulpe | Tu sais des mois d’avance combien il te restera",
  },
  description: SOCIAL_DESCRIPTION,
  applicationName: "Pulpe",
  verification: {
    google: "20-QgsBLcccy2f1lY275s0mayKmxWZZWo9Rg8aGxTQ0",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Pulpe | Tu sais des mois d’avance combien il te restera",
    description: SOCIAL_DESCRIPTION,
    siteName: "Pulpe",
    type: "website",
    url: "/",
    locale: "fr_CH",
    alternateLocale: ["fr_FR"],
    images: [
      {
        url: SOCIAL_PREVIEW_IMAGE,
        width: 1200,
        height: 630,
        alt: SOCIAL_PREVIEW_ALT,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pulpe | Tu sais des mois d’avance combien il te restera",
    description: SOCIAL_DESCRIPTION,
    images: [
      {
        url: SOCIAL_PREVIEW_IMAGE,
        alt: SOCIAL_PREVIEW_ALT,
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#eaf6e6",
  viewportFit: "cover",
};

// L'en-tête vit hors de React : le bundle applicatif arrive plusieurs secondes
// après la peinture sur mobile, et un `useEffect` laisserait la navbar
// transparente et le menu inerte pendant tout ce temps. L'ouverture du menu est
// native (`<details>`) ; ce script ne fournit que ce que le navigateur ne fait
// pas seul, et pose l'attribut de défilement sur `<html>` avant l'hydratation.
// Cet écart attendu est ignoré directement sur l'élément racine.
// The Header renders again on every client navigation, so no listener attaches
// to its elements and becomes orphaned. Events delegate through the document
// and fetch a fresh element with getElementById. `toggle` does not bubble, so
// it is captured.
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

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      // Single entity: /conseils-budget articles reference its @id as publisher
      // instead of defining it again.
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: "Pulpe",
      url: SITE_URL,
      logo: `${SITE_URL}/icon-192.png`,
    },
    {
      "@type": "WebSite",
      "@id": "https://pulpe.app/#website",
      url: "https://pulpe.app",
      name: "Pulpe",
      alternateName: ["pulpe", "Pulpe app", "pulpe.app"],
      description:
        "Pulpe calcule ton disponible mois après mois à partir de tes revenus, de tes dépenses et de ton épargne, sans connexion bancaire.",
      inLanguage: "fr-CH",
      publisher: { "@id": ORGANIZATION_ID },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://pulpe.app/#app",
      name: "Pulpe",
      description:
        "Pulpe calcule ton disponible mois après mois à partir de tes revenus, de tes dépenses et de ton épargne, sans connexion bancaire.",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={poppins.variable} suppressHydrationWarning>
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
        {/* Rendered by the layout and never recreated by client navigation, so
            the IntersectionObserver installed on first load stays alive. */}
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
