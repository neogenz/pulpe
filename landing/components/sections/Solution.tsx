import { Check } from 'lucide-react'
import { Section, Screenshot, FadeIn } from '@/components/ui'

export function Solution() {
  return (
    <Section id="solution">
      <div className="max-w-3xl mx-auto text-center mb-12">
        <FadeIn>
          <h2 className="text-2xl md:text-4xl font-bold mb-6">
            Une app qui pense à l'année
            <br />
            <span className="text-primary">pour que tu profites du mois</span>
          </h2>
          <p className="text-lg text-text-secondary mb-8">
            Les autres apps te montrent ce que tu as déjà dépensé. Pulpe te
            montre ce que tu peux encore dépenser.
          </p>
          <ul className="text-left text-text-secondary space-y-3 max-w-xl mx-auto">
            <li className="flex items-start gap-3">
              <Check className="w-4 h-4 text-primary mt-1 shrink-0" />
              <span>
                Tes impôts dans 4 mois ? Déjà budgétés.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-4 h-4 text-primary mt-1 shrink-0" />
              <span>
                Vacances en août ? Anticipées depuis janvier.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-4 h-4 text-primary mt-1 shrink-0" />
              <span>
                Ce qu'il te reste ce mois ? Toujours visible, au centime près.
              </span>
            </li>
          </ul>
        </FadeIn>
      </div>

      <FadeIn delay={0.2}>
        <Screenshot
          src="/screenshots/responsive/vue-calendrier-annuel.webp"
          desktopSrc="/screenshots/webapp/vue-calendrier-annuel.webp"
          label="Vue annuelle des budgets"
          className="w-full max-w-4xl mx-auto"
        />
      </FadeIn>
    </Section>
  )
}
