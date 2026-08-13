import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { PostHogProvider } from "../components/PostHogProvider";
import { getDictionary } from "../content/dictionary";
import {
  DESKTOP_BREAKPOINT_PX,
  MOBILE_NAV_ID,
  MOBILE_NAV_PANEL_ID,
  SCROLL_SENTINEL_ID,
} from "../lib/config";
import { DEFAULT_LOCALE } from "../lib/i18n";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: "normal",
  display: "swap",
  variable: "--font-poppins",
});

const SOCIAL_PREVIEW_IMAGE = "/pulpe-social-preview.png?v=2";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getDictionary(DEFAULT_LOCALE);

  return {
    metadataBase: new URL("https://pulpe.app"),
    title: {
      template: site.titleTemplate,
      default: site.titleDefault,
    },
    description: site.description,
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
      title: site.titleDefault,
      description: site.description,
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
          alt: site.socialImageAlt,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: site.titleDefault,
      description: site.description,
      images: [
        {
          url: SOCIAL_PREVIEW_IMAGE,
          alt: site.socialImageAlt,
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
}

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
if(panel){
function syncPanel(){
var closed=!nav.open;
panel.inert=closed;
if(closed)panel.setAttribute('aria-hidden','true');
else panel.removeAttribute('aria-hidden');
var links=panel.querySelectorAll('a');
for(var i=0;i<links.length;i++){
if(closed)links[i].setAttribute('tabindex','-1');
else links[i].removeAttribute('tabindex');
}
}
syncPanel();
nav.addEventListener('toggle',syncPanel);
panel.addEventListener('click',function(e){
var t=e.target;
if(t&&t.closest&&t.closest('#${MOBILE_NAV_PANEL_ID} a'))close();
});
}
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

function buildJsonLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://pulpe.app/#website",
        url: "https://pulpe.app",
        name: "Pulpe",
        alternateName: ["pulpe", "Pulpe app", "pulpe.app"],
        description,
        inLanguage: "fr-CH",
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://pulpe.app/#app",
        name: "Pulpe",
        description,
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
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { site } = await getDictionary(DEFAULT_LOCALE);
  const jsonLd = buildJsonLd(site.graphDescription);

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
        <PostHogProvider>{children}</PostHogProvider>
        <div id="lightbox-root" />
      </body>
    </html>
  );
}
