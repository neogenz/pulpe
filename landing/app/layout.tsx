import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { PostHogProvider } from "../components/PostHogProvider";
import {
  DESKTOP_BREAKPOINT_PX,
  MOBILE_NAV_ID,
  MOBILE_NAV_PANEL_ID,
  SCROLL_SENTINEL_ID,
} from "../lib/config";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: "normal",
  display: "swap",
  variable: "--font-poppins",
});

const SOCIAL_PREVIEW_IMAGE = "/pulpe-social-preview.png?v=2";
const SOCIAL_PREVIEW_ALT =
  "Pulpe projette ton budget sur l’année et montre combien il te restera";
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
  viewportFit: "cover",
};

// L'en-tête vit hors de React : le bundle applicatif arrive plusieurs secondes
// après la peinture sur mobile, et un `useEffect` laisserait la navbar
// transparente et le menu inerte pendant tout ce temps. L'ouverture du menu est
// native (`<details>`) ; ce script ne fournit que ce que le navigateur ne fait
// pas seul, et pose l'attribut de défilement sur `<html>`, un nœud que React ne
// rend pas, donc sans divergence d'hydratation possible.
const headerScript = `(function(){
if(window.pulpeHeaderReady)return;
window.pulpeHeaderReady=1;
function start(){
var sentinel=document.getElementById('${SCROLL_SENTINEL_ID}');
if(sentinel&&window.IntersectionObserver){
new IntersectionObserver(function(entries){
document.documentElement.toggleAttribute('data-scrolled',!entries[0].isIntersecting);
}).observe(sentinel);
}
var nav=document.getElementById('${MOBILE_NAV_ID}');
if(!nav)return;
function close(){if(nav.open)nav.open=false;}
var panel=document.getElementById('${MOBILE_NAV_PANEL_ID}');
if(panel)panel.addEventListener('click',function(e){
var t=e.target;
if(t&&t.closest&&t.closest('#${MOBILE_NAV_PANEL_ID} a'))close();
});
document.addEventListener('keydown',function(e){
if(e.key!=='Escape'||!nav.open)return;
nav.open=false;
var summary=nav.querySelector('summary');
if(summary)summary.focus({preventScroll:true});
});
window.addEventListener('scroll',close,{passive:true});
window.addEventListener('resize',function(){
if(window.innerWidth>=${DESKTOP_BREAKPOINT_PX})close();
});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
else start();
})();`;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://pulpe.app/#website",
      url: "https://pulpe.app",
      name: "Pulpe",
      alternateName: ["pulpe", "Pulpe app", "pulpe.app"],
      description:
        "Pulpe calcule ton disponible mois après mois à partir de tes revenus, de tes dépenses et de ton épargne, sans connexion bancaire.",
      inLanguage: "fr-CH",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://pulpe.app/#app",
      name: "Pulpe",
      description:
        "Pulpe calcule ton disponible mois après mois à partir de tes revenus, de tes dépenses et de ton épargne, sans connexion bancaire.",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web, iOS",
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
    <html lang="fr" className={poppins.variable}>
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
        <PostHogProvider>{children}</PostHogProvider>
        <div id="lightbox-root" />
      </body>
    </html>
  );
}
