import { Section, Badge, Screenshot, FadeIn } from '../ui'

const FEATURES = [
  {
    title: "Vois toute ton année d'un coup d'œil",
    description: 'Vacances, impôts, anniversaires... Tout est visible sur 12 mois.',
    badge: { icon: '🎯', label: 'Clarté' },
    screenshot: 'Vue annuelle',
  },
  {
    title: "2 clics, c'est noté",
    description: "Ajouter une dépense prend 5 secondes. Pas de friction, pas d'excuse.",
    badge: { icon: '⚡', label: 'Simplicité' },
    screenshot: 'Ajout rapide',
  },
  {
    title: 'Plus jamais surpris',
    description: 'Tes dépenses récurrentes sont planifiées. Tu vois venir les gros moments.',
    badge: { icon: '🛡️', label: 'Contrôle' },
    screenshot: 'Prévisions',
  },
  {
    title: 'Ton budget se construit tout seul',
    description: 'Crée un modèle une fois, réutilise-le chaque mois.',
    badge: { icon: '🌱', label: 'Légèreté' },
    screenshot: 'Modèles',
  },
]

export function Features() {
  return (
    <Section background="alt" id="features">
      <FadeIn>
        <h2 className="text-2xl md:text-4xl font-bold text-center mb-16">
          Comment Pulpe t'aide à voir clair
        </h2>
      </FadeIn>

      <div className="space-y-24">
        {FEATURES.map((feature, index) => (
          <FadeIn key={index} delay={0.1}>
            <div
              className={`grid lg:grid-cols-2 gap-8 lg:gap-16 items-center ${
                index % 2 === 1 ? 'lg:flex-row-reverse' : ''
              }`}
            >
              <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                <Badge className="mb-4">
                  <span role="img" aria-hidden="true">{feature.badge.icon}</span>
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
                  label={feature.screenshot}
                  className="aspect-[4/3] w-full"
                />
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </Section>
  )
}
