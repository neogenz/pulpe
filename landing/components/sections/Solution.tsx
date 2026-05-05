import { Section, Screenshot, FadeIn } from '@/components/ui'

export function Solution() {
  return (
    <Section background="grain" id="solution">
      <FadeIn variant="blur">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-[-0.02em] leading-[1.1] balance">
            Planifie une fois.
            <br />
            <span className="italic font-normal text-primary">
              Profite 12 mois.
            </span>
          </h2>
          <p className="text-lg md:text-xl text-text-secondary mt-5 max-w-xl mx-auto pretty">
            Les autres apps te montrent ce que tu as déjà dépensé.
            Pulpe te montre ce que tu peux{' '}
            <span className="text-primary font-semibold">encore dépenser</span>.
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
