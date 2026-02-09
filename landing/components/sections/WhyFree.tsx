import { Section, Badge, FadeIn } from '@/components/ui'
import { ANGULAR_APP_URL } from '@/lib/config'

export function WhyFree() {
  return (
    <Section background="alt" id="why-free">
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-12">
            Pourquoi Pulpe est gratuit
          </h2>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="space-y-8 text-text-secondary">
            <div className="border-l-2 border-primary/20 pl-6">
              <h3 className="font-semibold text-text mb-2">Un projet né d'un vrai besoin</h3>
              <p>
                J'ai créé Pulpe parce que j'en avais marre de galérer à suivre mon budget sur mobile.
                Ça m'aide beaucoup au quotidien, quelques amis aussi — je me dis que ça peut aider d'autres personnes.
              </p>
            </div>

            <div className="border-l-2 border-primary/20 pl-6">
              <h3 className="font-semibold text-text mb-2">Gratuit et open source</h3>
              <p>
                Pas de publicité, pas d'abonnement caché. Un projet personnel développé par passion.
              </p>
            </div>

            <div className="border-l-2 border-primary/20 pl-6">
              <h3 className="font-semibold text-text mb-2">Tes données sont protégées</h3>
              <p>
                Analytics hébergés en Europe, tes montants sont protégés par chiffrement et contrôle d'accès.
              </p>
            </div>

            <p className="font-semibold text-text pt-4">
              — Maxime, créateur de Pulpe
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="flex flex-wrap gap-3 justify-center mt-10">
            <Badge>Open Source</Badge>
            <Badge>Hébergé en Europe</Badge>
            <Badge>Données masquées</Badge>
          </div>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="flex flex-wrap gap-4 justify-center mt-8 text-sm">
            <a
              href="https://github.com/neogenz/pulpe"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Voir le code source
            </a>
            <a href={`${ANGULAR_APP_URL}/legal/cgu`} className="text-accent hover:underline">CGU</a>
            <a href={`${ANGULAR_APP_URL}/legal/confidentialite`} className="text-accent hover:underline">Confidentialité</a>
          </div>
        </FadeIn>
      </div>
    </Section>
  )
}
