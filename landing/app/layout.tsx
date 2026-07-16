import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { PostHogProvider } from "../components/PostHogProvider";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: "normal",
  display: "swap",
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pulpe.app"),
  title: {
    template: "%s – Pulpe",
    default: "Pulpe – Tu sais des mois d’avance ce qu’il te restera",
  },
  description:
    "Impôts, vacances, imprévus : Pulpe place ton année devant toi et projette ton solde mois après mois, sans connexion bancaire.",
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
    title: "Pulpe – Tu sais des mois d’avance ce qu’il te restera",
    description:
      "Place ton année devant toi et projette ton solde mois après mois, sans connexion bancaire.",
    siteName: "Pulpe",
    type: "website",
    url: "/",
    locale: "fr_CH",
    alternateLocale: ["fr_FR"],
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Pulpe, le budget tourné vers les mois qui viennent",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pulpe – Tu sais des mois d’avance ce qu’il te restera",
    description:
      "Place ton année devant toi et projette ton solde mois après mois, sans connexion bancaire.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

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
        "Pulpe place ton année devant toi et projette ton solde mois après mois, sans connexion bancaire.",
      inLanguage: "fr-CH",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://pulpe.app/#app",
      name: "Pulpe",
      description:
        "Pulpe place ton année devant toi et projette ton solde mois après mois, sans connexion bancaire.",
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
