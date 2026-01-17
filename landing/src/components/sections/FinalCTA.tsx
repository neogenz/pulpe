import { Button, FadeIn } from '../ui'

export function FinalCTA() {
  return (
    <section className="py-20 md:py-28 bg-primary">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <FadeIn>
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
            Prêt à reprendre le contrôle ?
          </h2>
          <p className="text-white/80 mb-8">
            Essaie Pulpe gratuitement. Pas de carte bancaire, pas d'engagement.
          </p>
          <Button
            variant="secondary"
            className="bg-white text-primary hover:bg-white/90"
          >
            Commencer maintenant
          </Button>
        </FadeIn>
      </div>
    </section>
  )
}
