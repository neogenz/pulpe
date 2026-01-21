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
          <p className="text-lg text-text-secondary">
            Au lieu de tracker ce qui est passé, tu planifies ce qui arrive.
            Résultat : tu sais toujours où tu en es.
          </p>
        </FadeIn>
      </div>

      <FadeIn delay={0.2}>
        <Screenshot
          src="/landing/screenshots/responsive/vue-calendrier-annuel.png"
          desktopSrc="/landing/screenshots/webapp/vue-calendrier-annuel.png"
          label="Vue annuelle des budgets"
          className="w-full max-w-4xl mx-auto"
        />
      </FadeIn>
    </Section>
  )
}
