import { Section, Button, FadeIn } from '@/components/ui'
import { ANGULAR_APP_URL } from '@/lib/config'
import { Check } from 'lucide-react'

const STEPS = [
  { number: '1', title: 'Tes revenus', description: 'Ce qui rentre chaque mois' },
  { number: '2', title: 'Frais fixes', description: 'Loyer, abonnements, assurances' },
  { number: '3', title: 'Frais variables', description: 'Vacances, impôts, anniversaires' },
  { number: 'done', title: 'Ton année est prête', description: 'Tu vois chaque mois, chaque dépense, ce qu\'il te reste' },
]

export function HowItWorks() {
  return (
    <Section background="grain" id="how-it-works">
      <FadeIn variant="blur">
        <h2 className="text-2xl md:text-4xl font-bold text-center mb-4">
          Prêt en 3 minutes
        </h2>
        <p className="text-text-secondary text-center mb-12">
          Pas de configuration complexe. Juste l&apos;essentiel.
        </p>
      </FadeIn>

      {/* Desktop: clean horizontal steps */}
      <div className="hidden md:grid md:grid-cols-4 gap-8 mb-12">
        {STEPS.map((step, index) => {
          const isDone = step.number === 'done'
          return (
            <FadeIn key={step.title} variant="blur" delay={index * 0.1}>
              <div className="text-center">
                <div
                  className={`w-12 h-12 rounded-full font-bold text-xl flex items-center justify-center mx-auto mb-4 ${
                    isDone ? 'bg-white text-primary shadow-organic' : 'bg-primary text-white'
                  }`}
                >
                  {isDone ? <Check className="w-5 h-5" /> : step.number}
                </div>
                <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-text-secondary">{step.description}</p>
              </div>
            </FadeIn>
          )
        })}
      </div>

      {/* Mobile: vertical timeline */}
      <div className="md:hidden mb-12">
        <div className="relative pl-16">
          <div className="space-y-8">
            {STEPS.map((step, index) => {
              const isDone = step.number === 'done'
              const isLast = index === STEPS.length - 1
              return (
                <FadeIn key={step.title} variant="blur" delay={index * 0.1} className="relative">
                  <div className="absolute -left-16 top-0 bottom-0">
                    <div
                      className={`w-12 h-12 rounded-full font-bold text-xl flex items-center justify-center shrink-0 relative z-10 ${
                        isDone ? 'bg-white text-primary shadow-organic' : 'bg-primary text-white'
                      }`}
                    >
                      {isDone ? <Check className="w-5 h-5" /> : step.number}
                    </div>
                    {!isLast && (
                      <div
                        className="absolute left-[23px] top-12 bottom-[-2.5rem] border-l-2 border-dashed border-primary/20"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="pt-1">
                    <h3 className="font-semibold text-lg mb-1">{step.title}</h3>
                    <p className="text-text-secondary text-sm">{step.description}</p>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </div>

      <FadeIn variant="blur" delay={0.4}>
        <div className="text-center">
          <Button href={`${ANGULAR_APP_URL}/signup`}>Créer mon budget</Button>
        </div>
      </FadeIn>
    </Section>
  )
}
