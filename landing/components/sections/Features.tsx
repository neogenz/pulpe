import { Section, Badge, Screenshot, FadeIn } from '@/components/ui'
import { Target, Zap, ShieldCheck, Sprout } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const FEATURES = [
  {
    title: 'Fini les impôts qui tombent au pire moment',
    description: 'Ta vue annuelle affiche chaque dépense prévue sur 12 mois. Vacances, impôts, anniversaires — tu vois tout venir.',
    badge: { Icon: Target, label: 'Clarté' },
    screenshot: {
      src: '/screenshots/responsive/vue-calendrier-annuel.webp',
      desktopSrc: '/screenshots/webapp/vue-calendrier-annuel.webp',
      label: 'Vue calendrier annuel',
    },
  },
  {
    title: 'Assez simple pour ne jamais lâcher',
    description: 'Note une dépense en 5 secondes, 2 clics. Pas de friction, pas de corvée — tu gardes le rythme.',
    badge: { Icon: Zap, label: 'Simplicité' },
    screenshot: {
      src: '/screenshots/responsive/modal-ajout-transaction.webp',
      desktopSrc: '/screenshots/webapp/modal-ajout-transaction.webp',
      label: 'Modal ajout de transaction',
    },
  },
  {
    title: 'Plus jamais surpris',
    description: 'Tes dépenses récurrentes sont planifiées automatiquement. Tu sais exactement ce qui arrive — et quand.',
    badge: { Icon: ShieldCheck, label: 'Contrôle' },
    screenshot: {
      src: '/screenshots/responsive/liste-des-previsions.webp',
      desktopSrc: '/screenshots/webapp/liste-des-previsions.webp',
      label: 'Liste des prévisions',
    },
  },
  {
    title: 'Chaque mois commence déjà organisé',
    description: 'Crée un modèle une fois, et chaque nouveau mois démarre avec tes revenus, charges et objectifs en place.',
    badge: { Icon: Sprout, label: 'Légèreté' },
    screenshot: {
      src: '/screenshots/responsive/ecran-des-modeles.webp',
      desktopSrc: '/screenshots/webapp/ecran-des-modeles.webp',
      label: 'Écran des modèles',
    },
  },
]

export function Features() {
  return (
    <Section background="alt" id="features">
      <FadeIn>
        <h2 className="text-2xl md:text-4xl font-bold text-center mb-12">
          Comment Pulpe t'aide à voir clair
        </h2>
      </FadeIn>

      <div className="space-y-24">
        {FEATURES.map((feature, index) => (
          <FadeIn key={feature.title} delay={0.1}>
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                <Badge className="mb-4">
                  <feature.badge.Icon className="w-4 h-4" />
                  {feature.badge.label}
                </Badge>
                <h3 className="text-xl md:text-2xl font-semibold mb-3">
                  {feature.title}
                </h3>
                <p className="text-text-secondary text-lg">
                  {feature.description}
                </p>
              </div>
              <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                <Screenshot
                  src={feature.screenshot.src}
                  desktopSrc={feature.screenshot.desktopSrc}
                  label={feature.screenshot.label}
                />
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </Section>
  )
}
