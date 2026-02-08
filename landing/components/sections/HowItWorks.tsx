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
    <Section id="how-it-works">
      <FadeIn>
        <h2 className="text-2xl md:text-4xl font-bold text-center mb-4">
          Prêt en 3 minutes
        </h2>
        <p className="text-text-secondary text-center mb-12">
          Pas de configuration complexe. Juste l'essentiel.
        </p>
      </FadeIn>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
        {STEPS.map((step, index) => (
          <FadeIn key={step.title} delay={index * 0.1}>
            <div className="text-center">
              <div className={`w-12 h-12 rounded-full font-bold text-xl flex items-center justify-center mx-auto mb-4 ${step.number === 'done' ? 'bg-primary/10 text-primary' : 'bg-primary text-white'}`}>
                {step.number === 'done' ? <Check className="w-5 h-5" /> : step.number}
              </div>
              <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
              <p className="text-text-secondary">{step.description}</p>
            </div>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.3}>
        <div className="text-center">
          <Button href={`${ANGULAR_APP_URL}/signup`}>Créer mon budget</Button>
        </div>
      </FadeIn>
    </Section>
  )
}
