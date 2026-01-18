import { CalendarX, TableProperties, CircleHelp } from 'lucide-react'
import { Section, Card, FadeIn } from '../ui'

const PAIN_POINTS = [
  {
    icon: CalendarX,
    title: 'Mauvaises surprises',
    text: 'Les impôts qui tombent au pire moment, une grosse dépense oubliée',
  },
  {
    icon: TableProperties,
    title: 'Prise de tête',
    text: 'Noter une dépense = une corvée. Résultat : on laisse tomber.',
  },
  {
    icon: CircleHelp,
    title: 'Budget flou',
    text: 'Jamais vraiment sûr de ce que tu peux dépenser ce mois-ci',
  },
]

export function PainPoints() {
  return (
    <Section background="alt" id="pain-points" className="pt-32 md:pt-44 lg:pt-56">
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
              <h3 className="font-semibold text-text mb-2">{point.title}</h3>
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
