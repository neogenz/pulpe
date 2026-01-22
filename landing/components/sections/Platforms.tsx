import { Globe, Smartphone, Apple } from 'lucide-react'
import { Section, Badge, Button, FadeIn } from '@/components/ui'
import { ANGULAR_APP_URL } from '@/lib/config'

const IOS_APP_URL = '#' // TODO: Remplacer par le lien App Store

export function Platforms() {
  return (
    <Section id="platforms">
      <FadeIn>
        <h2 className="text-2xl md:text-4xl font-bold text-center mb-4">
          Disponible partout
        </h2>
        <p className="text-center text-text-secondary text-lg mb-12 max-w-2xl mx-auto">
          Accède à Pulpe depuis ton navigateur ou télécharge l'app native pour une expérience optimale.
        </p>
      </FadeIn>

      <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
        {/* Web App */}
        <FadeIn delay={0.1}>
          <div className="bg-surface rounded-[var(--radius-card)] p-6 lg:p-8 border border-text/5 shadow-[var(--shadow-card)] h-full flex flex-col">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Web App</h3>
            <p className="text-text-secondary mb-6 flex-1">
              Utilise Pulpe directement dans ton navigateur, sur ordinateur ou téléphone. Aucune installation requise.
            </p>
            <a href={`${ANGULAR_APP_URL}/welcome`}>
              <Button variant="secondary" className="w-full">
                Ouvrir dans le navigateur
              </Button>
            </a>
          </div>
        </FadeIn>

        {/* iOS App */}
        <FadeIn delay={0.2}>
          <div className="bg-surface rounded-[var(--radius-card)] p-6 lg:p-8 border border-text/5 shadow-[var(--shadow-card)] h-full flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Apple className="w-6 h-6 text-primary" />
              </div>
              <Badge>Nouveau</Badge>
            </div>
            <h3 className="text-xl font-semibold mb-2">App iOS</h3>
            <p className="text-text-secondary mb-6 flex-1">
              Une app native optimisée pour iPhone. Notifications, widgets, et expérience fluide.
            </p>
            <a
              href={IOS_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              aria-label="Télécharger sur l'App Store"
            >
              <img
                src="/app-store-badge.svg"
                alt="Télécharger sur l'App Store"
                width={120}
                height={40}
                loading="lazy"
                className="h-12 mx-auto"
              />
            </a>
          </div>
        </FadeIn>

        {/* Android */}
        <FadeIn delay={0.3}>
          <div className="bg-surface rounded-[var(--radius-card)] p-6 lg:p-8 border border-text/5 shadow-[var(--shadow-card)] h-full flex flex-col opacity-75">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-text/5 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-text-secondary" />
              </div>
              <Badge>Bientôt</Badge>
            </div>
            <h3 className="text-xl font-semibold mb-2">App Android</h3>
            <p className="text-text-secondary mb-6 flex-1">
              L'app Android est en cours de développement. En attendant, utilise la web app sur ton téléphone.
            </p>
            <Button variant="ghost" disabled className="w-full">
              Arrive bientôt
            </Button>
          </div>
        </FadeIn>
      </div>
    </Section>
  )
}
