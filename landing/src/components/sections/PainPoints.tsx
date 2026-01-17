import { CalendarX, TableProperties, CircleHelp } from 'lucide-react'
import { Section, Card, FadeIn } from '../ui'

const PAIN_POINTS = [
  {
    icon: CalendarX,
    text: 'Être surpris par les impôts ou une grosse dépense oubliée',
  },
  {
    icon: TableProperties,
    text: 'Ouvrir Excel sur mobile pour noter une dépense... et abandonner',
  },
  {
    icon: CircleHelp,
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
              <div className="flex justify-center mb-4">
                <point.icon className="w-10 h-10 text-primary" strokeWidth={1.5} />
              </div>
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
