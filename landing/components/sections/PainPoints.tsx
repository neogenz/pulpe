import { CalendarX, TableProperties, CircleHelp } from 'lucide-react'
import { Section, FadeIn, Card } from '@/components/ui'

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
    <Section background="grain" id="pain-points">
      <FadeIn variant="blur">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center max-w-3xl mx-auto leading-snug">
          Tu ouvres ton tableur.<br className="hidden md:inline" /> Tu soupires. Tu refermes.
        </h2>
      </FadeIn>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
        {PAIN_POINTS.map((point, index) => (
          <FadeIn key={point.title} variant="blur" delay={(index + 1) * 0.1}>
            <Card variant="organic" className="h-full p-6 lg:p-8">
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-primary/10 mb-5">
                <point.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold text-lg text-text mb-2">{point.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{point.text}</p>
            </Card>
          </FadeIn>
        ))}
      </div>

      <FadeIn variant="blur" delay={0.4}>
        <p className="text-center text-lg md:text-xl font-semibold text-primary mt-12">
          Pulpe a été créée pour en finir avec ça.
        </p>
      </FadeIn>
    </Section>
  )
}
