import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
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
        url: '/icon.png',
        width: 519,
        height: 519,
        alt: 'Pulpe',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Pulpe — L'app budget simple pour planifier ton année",
    description: 'Planifie ton année, anticipe les grosses dépenses, note tes achats en 2 clics.',
    images: ['/icon.png'],
  },
  icons: {
    icon: '/icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={poppins.variable}>
      <body className="font-sans antialiased">
        {children}
        <div id="lightbox-root" />
      </body>
    </html>
  )
}
