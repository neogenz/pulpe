import { Section, Badge, Screenshot, FadeIn } from '@/components/ui'
import { Zap, ShieldCheck, Sprout } from 'lucide-react'

const FEATURES = [
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
    title: 'Tes charges sont déjà là. Toi, tu pointes.',
    description: 'Tes dépenses récurrentes apparaissent chaque mois automatiquement. Tu ne fais que confirmer ce qui a été débité.',
    badge: { Icon: ShieldCheck, label: 'Contrôle' },
    screenshot: {
      src: '/screenshots/responsive/liste-des-previsions.webp',
      desktopSrc: '/screenshots/webapp/liste-des-previsions.webp',
      label: 'Liste des prévisions',
    },
  },
  {
    title: 'Un modèle. 12 mois. Zéro copier-coller.',
    description: 'Décris ton mois type une fois. Chaque nouveau mois se génère en un clic. Un frais qui change ? Modifie le modèle, les mois suivants s\'adaptent.',
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
    <Section id="features">
      <FadeIn variant="blur">
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-14 tracking-[-0.02em] balance">
          Comment Pulpe{' '}
          <span className="italic font-normal text-primary">
            reste simple.
          </span>
        </h2>
      </FadeIn>

      <div className="space-y-20 md:space-y-24">
        {FEATURES.map((feature, index) => (
          <FadeIn key={feature.title} variant="blur" delay={0.1}>
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                <Badge className="mb-4">
                  <feature.badge.Icon className="w-4 h-4" />
                  {feature.badge.label}
                </Badge>
                <h3 className="text-xl md:text-2xl lg:text-[1.75rem] font-semibold mb-3 tracking-[-0.01em] leading-[1.2] balance">
                  {feature.title}
                </h3>
                <p className="text-text-secondary text-lg leading-relaxed pretty">
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
