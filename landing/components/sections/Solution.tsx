import { Section, Screenshot, FadeIn } from '@/components/ui'

export function Solution() {
  return (
    <Section id="solution">
      <FadeIn variant="blur">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold">
            Une app qui pense à l&apos;année
            <br />
            <span className="text-primary">pour que tu profites du mois</span>
          </h2>
          <p className="text-lg text-text-secondary mt-4 max-w-xl mx-auto">
            Les autres apps te montrent ce que tu as déjà dépensé. Pulpe te
            montre ce que tu peux encore dépenser.
          </p>
          <ul className="text-left text-text-secondary space-y-3 max-w-xl mx-auto mt-8">
            <li className="flex items-start gap-3">
              <span className="text-primary mt-1 shrink-0">&#10003;</span>
              <span>Tes impôts dans 4 mois ? Déjà budgétés.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary mt-1 shrink-0">&#10003;</span>
              <span>Vacances en août ? Anticipées depuis janvier.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary mt-1 shrink-0">&#10003;</span>
              <span>Ce qu&apos;il te reste ce mois ? Toujours visible, au centime près.</span>
            </li>
          </ul>
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
