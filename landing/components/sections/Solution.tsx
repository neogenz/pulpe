import { Section, Screenshot, FadeIn } from '@/components/ui'

export function Solution() {
  return (
    <Section background="grain" id="solution">
      <FadeIn variant="blur">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold">
            Planifie une fois.
            <br />
            <span className="text-primary">Profite 12 mois.</span>
          </h2>
          <p className="text-lg md:text-xl text-text-secondary mt-4 max-w-xl mx-auto">
            Les autres apps te montrent ce que tu as déjà dépensé.
            Pulpe te montre ce que tu peux <span className="text-primary font-semibold">encore dépenser</span>.
            Et si un mois dérape, le suivant s&apos;ajuste tout seul.
          </p>
        </div>
      </FadeIn>

      <FadeIn variant="blur" delay={0.2}>
        <div className="mt-12 rounded-2xl overflow-hidden border border-text/5 shadow-[var(--shadow-screenshot)]">
          <Screenshot
            src="/screenshots/responsive/vue-calendrier-annuel.webp"
            desktopSrc="/screenshots/webapp/vue-calendrier-annuel.webp"
            label="Vue annuelle des budgets"
            className="w-full"
          />
        </div>
      </FadeIn>
    </Section>
  )
}
