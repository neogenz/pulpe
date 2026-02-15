import Link from 'next/link'
import { Heart } from 'lucide-react'
import { Container } from '@/components/ui'
import { ANGULAR_APP_URL } from '@/lib/config'

export function Footer() {
  return (
    <footer className="py-12 bg-surface">
      {/* Gradient border replacing solid border */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent mb-12" aria-hidden="true" />

      <Container>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 font-bold text-xl text-text">
            <img src="/icon-64.webp" alt="Pulpe logo" width={32} height={32} loading="lazy" className="h-8 w-auto" />
            <span>Pulpe</span>
          </div>

          <nav aria-label="Liens utiles" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 md:gap-x-6 text-sm text-text-secondary">
            <a
              href="https://github.com/neogenz/pulpe"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text transition-colors py-3"
            >
              Code source
            </a>
            <a href={`${ANGULAR_APP_URL}/legal/cgu`} className="hover:text-text transition-colors py-3">
              Conditions d'utilisation
            </a>
            <a href={`${ANGULAR_APP_URL}/legal/confidentialite`} className="hover:text-text transition-colors py-3">
              Politique de confidentialité
            </a>
            <Link href="/changelog" className="hover:text-text transition-colors py-3">
              Nouveautés
            </Link>
            <Link href="/support" className="hover:text-text transition-colors py-3">
              Support
            </Link>
            <a
              href="mailto:maxime.desogus@gmail.com"
              className="hover:text-text transition-colors py-3"
            >
              Contact
            </a>
          </nav>

          <p className="text-sm text-text-secondary">
            Fait avec <Heart className="w-4 h-4 text-red-500 inline-block align-text-bottom" aria-hidden="true" /> en Suisse
          </p>
        </div>
      </Container>
    </footer>
  )
}
