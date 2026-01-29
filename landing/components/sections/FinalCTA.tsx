import { Button, FadeIn } from '@/components/ui'
import { ANGULAR_APP_URL } from '@/lib/config'

export function FinalCTA() {
  return (
    <section className="py-20 md:py-28 bg-primary">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <FadeIn>
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
            Tu sais ce qu'il te reste ce mois ?
          </h2>
          <p className="text-white/80 mb-8">
            Crée ton premier budget en 3 minutes. Gratuit, sans compte bancaire
            à connecter.
          </p>
          <a href={`${ANGULAR_APP_URL}/signup`}>
            <Button
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90"
            >
              Commencer maintenant
            </Button>
          </a>
        </FadeIn>
      </div>
    </section>
  )
}
