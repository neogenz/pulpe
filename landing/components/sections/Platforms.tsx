import { Globe, Smartphone, Apple } from 'lucide-react'
import { Section, Badge, Button, FadeIn, Card, ShineBorder } from '@/components/ui'
import { ANGULAR_APP_URL } from '@/lib/config'

const IOS_APP_URL = '#' // TODO: Remplacer par le lien App Store

export function Platforms() {
  return (
    <Section id="platforms">
      <FadeIn variant="blur">
        <h2 className="text-2xl md:text-4xl font-bold text-center mb-4">
          Disponible partout
        </h2>
        <p className="text-center text-text-secondary text-lg mb-12 max-w-2xl mx-auto">
          Accède à Pulpe depuis ton navigateur ou télécharge l'app native pour une expérience optimale.
        </p>
      </FadeIn>

      <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
        {/* Web App */}
        <FadeIn variant="blur" delay={0.1}>
          <Card variant="elevated" className="h-full flex flex-col items-center text-center p-6 lg:p-8">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Web App</h3>
            <p className="text-text-secondary mb-6 flex-1">
              Utilise Pulpe directement dans ton navigateur, sur ordinateur ou téléphone. Aucune installation requise.
            </p>
            <Button href={`${ANGULAR_APP_URL}/welcome`} variant="secondary" className="w-full">
              Ouvrir dans le navigateur
            </Button>
          </Card>
        </FadeIn>

        {/* iOS App — prominent */}
        <FadeIn variant="blur" delay={0.2}>
          <ShineBorder borderRadius={20} duration={10} className="h-full">
            <Card variant="organic" className="h-full flex flex-col items-center text-center p-8 lg:p-10">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Apple className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">App iOS</h3>
              <Badge className="mb-4">Nouveau</Badge>
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
            </Card>
          </ShineBorder>
        </FadeIn>

        {/* Android */}
        <FadeIn variant="blur" delay={0.3}>
          <Card variant="elevated" className="h-full flex flex-col items-center text-center p-6 lg:p-8 opacity-60">
            <div className="w-12 h-12 rounded-full bg-text/5 flex items-center justify-center mb-4">
              <Smartphone className="w-6 h-6 text-text-secondary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">App Android</h3>
            <Badge className="mb-4">Bientôt</Badge>
            <p className="text-text-secondary mb-6 flex-1">
              L'app Android est en cours de développement. En attendant, utilise la web app sur ton téléphone.
            </p>
            <Button variant="ghost" disabled className="w-full">
              Arrive bientôt
            </Button>
          </Card>
        </FadeIn>
      </div>
    </Section>
  )
}
