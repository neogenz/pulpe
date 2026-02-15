import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import { PreloadLCPImage } from '@/components/ui'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'optional',
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://pulpe.app'),
  title: "Pulpe — L'app budget simple pour planifier ton année",
  description:
    "Planifie ton année, anticipe les grosses dépenses, note tes achats en 2 clics. Pulpe t'aide à voir clair dans tes finances sans prise de tête.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Pulpe — Planifie ton année. Profite de ton mois.',
    description: "L'app budget hyper simple qui remplace Excel. Essaie gratuitement.",
    type: 'website',
    url: '/',
    locale: 'fr_FR',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Pulpe - App budget simple pour planifier ton année',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Pulpe — L'app budget simple pour planifier ton année",
    description: 'Planifie ton année, anticipe les grosses dépenses, note tes achats en 2 clics.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/icon.png',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://pulpe.app/#website',
      url: 'https://pulpe.app',
      name: 'Pulpe',
      description:
        "L'app budget simple pour planifier ton année. Anticipe les grosses dépenses et note tes achats en 2 clics.",
      inLanguage: 'fr-FR',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://pulpe.app/#app',
      name: 'Pulpe',
      description:
        "Planifie ton année, anticipe les grosses dépenses, note tes achats en 2 clics. Pulpe t'aide à voir clair dans tes finances sans prise de tête.",
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web, iOS',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'CHF',
      },
    },
  ],
}

// Static script only — never inject dynamic data (XSS risk)
// Only redirect on homepage — sub-pages like /support must remain accessible
const authRedirectScript = `
(function() {
  try {
    if (window.location.pathname !== '/') return;
    var keys = Object.keys(localStorage);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].match(/^sb-.*-auth-token$/)) {
        var data = localStorage.getItem(keys[i]);
        if (data) {
          var parsed = JSON.parse(data);
          if (parsed.access_token) {
            window.location.replace('/dashboard');
            return;
          }
        }
      }
    }
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={poppins.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: authRedirectScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <PreloadLCPImage
          mobileSrc="/screenshots/mobile/dashboard.webp"
          desktopSrc="/screenshots/webapp/dashboard.webp"
        />
        {children}
        <div id="lightbox-root" />
      </body>
    </html>
  )
}
