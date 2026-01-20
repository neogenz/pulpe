import { Container } from '../ui'

export function Footer() {
  return (
    <footer className="py-12 bg-surface border-t border-text/5">
      <Container>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 font-bold text-xl text-text">
            <img src="/icon.png" alt="" aria-hidden="true" className="h-8 w-auto" />
            <span>Pulpe</span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm text-text-secondary">
            <a
              href="https://github.com/maximedesogus/pulpe"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text transition-colors"
            >
              Code source
            </a>
            <a href="/legal/cgu" className="hover:text-text transition-colors">
              Conditions d'utilisation
            </a>
            <a href="/legal/confidentialite" className="hover:text-text transition-colors">
              Politique de confidentialité
            </a>
            <a
              href="mailto:maxime.desogus@gmail.com"
              className="hover:text-text transition-colors"
            >
              Contact
            </a>
          </nav>

          <p className="text-sm text-text-secondary">
            Fait avec <span role="img" aria-label="amour">❤️</span> en Suisse
          </p>
        </div>
      </Container>
    </footer>
  )
}
