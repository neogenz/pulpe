import { Section, Button, FadeIn } from '@/components/ui'

const STEPS = [
  { number: '1', title: 'Tes revenus', description: 'Ce qui rentre chaque mois' },
  { number: '2', title: 'Tes récurrents', description: 'Loyer, abonnements, assurances' },
  { number: '3', title: 'Tes événements', description: 'Vacances, impôts, anniversaires' },
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

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {STEPS.map((step, index) => (
          <FadeIn key={step.title} delay={index * 0.1}>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
                {step.number}
              </div>
              <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
              <p className="text-text-secondary">{step.description}</p>
            </div>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.3}>
        <div className="text-center">
          <Button>Créer mon budget</Button>
        </div>
      </FadeIn>
    </Section>
  )
}
