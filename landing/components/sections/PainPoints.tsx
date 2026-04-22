import { CalendarX, TableProperties, Smartphone } from 'lucide-react'
import { Section, FadeIn, Card } from '@/components/ui'

const LEAD = {
  icon: CalendarX,
  month: 'Juillet',
  title: 'Les impôts tombent.',
  text: "T'avais pas prévu. Le mois déraille. Tu rattrapes comme tu peux — en piochant dans l'épargne, en repoussant les vacances, en serrant la ceinture.",
}

const SUPPORTING = [
  {
    icon: TableProperties,
    title: 'Ton Excel a 12 feuilles',
    text: "Nouvelle année ? Tout refaire. Frais fixe qui change ? 4 mois à modifier à la main.",
  },
  {
    icon: Smartphone,
    title: 'Tu dépenses. Tu notes pas.',
    text: "Ouvrir le tableur sur le tel, zoomer, trouver la cellule... Tu laisses tomber.",
  },
]

export function PainPoints() {
  return (
    <Section id="pain-points">
      <FadeIn variant="blur">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center max-w-3xl mx-auto leading-[1.1] tracking-[-0.02em] balance">
          Tu ouvres ton tableur.<br className="hidden md:inline" />{' '}
          <span className="italic font-normal text-text-secondary">
            Tu soupires. Tu refermes.
          </span>
        </h2>
      </FadeIn>

      {/* Asymmetric grid: one tall lead card + two stacked supporting cards.
          Breaks the generic 3-equal-cards AI feature-row pattern. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mt-14 items-stretch">
        <FadeIn variant="blur" delay={0.1} className="lg:col-span-3">
          <Card
            variant="organic"
            className="h-full p-7 lg:p-10 relative overflow-hidden"
          >
            <div
              aria-hidden="true"
              className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-primary/5 blur-2xl"
            />
            <div className="relative">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] uppercase text-primary/80 mb-4">
                <span className="w-6 h-px bg-primary/40" aria-hidden="true" />
                {LEAD.month}
              </div>
              <div className="flex items-start gap-4 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 shrink-0">
                  <LEAD.icon
                    className="w-6 h-6 text-primary"
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="font-semibold text-2xl md:text-3xl text-text leading-tight balance">
                  {LEAD.title}
                </h3>
              </div>
              <p className="text-text-secondary text-base md:text-lg leading-relaxed max-w-md pretty">
                {LEAD.text}
              </p>
            </div>
          </Card>
        </FadeIn>

        <div className="lg:col-span-2 grid grid-cols-1 gap-5">
          {SUPPORTING.map((point, index) => (
            <FadeIn
              key={point.title}
              variant="blur"
              delay={(index + 2) * 0.1}
              className="h-full"
            >
              <Card variant="organic" className="h-full p-6 lg:p-7">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0">
                    <point.icon
                      className="w-5 h-5 text-primary"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="font-semibold text-lg text-text leading-tight">
                    {point.title}
                  </h3>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed pretty">
                  {point.text}
                </p>
              </Card>
            </FadeIn>
          ))}
        </div>
      </div>

      <FadeIn variant="blur" delay={0.4}>
        <p className="text-center text-lg md:text-2xl mt-14 balance">
          <span className="italic text-text-secondary">
            Pulpe existe pour ça.
          </span>
        </p>
      </FadeIn>
    </Section>
  )
}
