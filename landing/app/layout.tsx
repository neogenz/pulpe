import type { Metadata, Viewport } from "next";
import { PostHogProvider } from "../components/PostHogProvider";
import "./globals.css";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaf6e6" },
    { media: "(prefers-color-scheme: dark)", color: "#141210" },
  ],
  viewportFit: "cover",
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
    <html lang="fr">
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
      </body>
    </html>
  );
}
