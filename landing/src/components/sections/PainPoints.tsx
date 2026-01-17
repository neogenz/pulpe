import { Section, Card, FadeIn } from '../ui'

const PAIN_POINTS = [
  {
    icon: '📅',
    text: 'Être surpris par les impôts ou une grosse dépense oubliée',
  },
  {
    icon: '📱',
    text: 'Ouvrir Excel sur mobile pour noter une dépense... et abandonner',
  },
  {
    icon: '🤷',
    text: 'Ne jamais savoir combien tu peux vraiment dépenser ce mois-ci',
  },
]

export function PainPoints() {
  return (
    <Section background="alt" id="pain-points">
      <FadeIn>
        <h2 className="text-2xl md:text-4xl font-bold text-center mb-12">
          Tu connais cette sensation ?
        </h2>
      </FadeIn>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {PAIN_POINTS.map((point, index) => (
          <FadeIn key={index} delay={index * 0.1}>
            <Card variant="elevated" className="h-full text-center">
              <span className="text-4xl mb-4 block" role="img" aria-hidden="true">
                {point.icon}
              </span>
              <p className="text-text-secondary">{point.text}</p>
            </Card>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.3}>
        <p className="text-center text-lg md:text-xl font-semibold text-primary">
          Pulpe a été créée pour en finir avec ça.
        </p>
      </FadeIn>
    </Section>
  )
}
