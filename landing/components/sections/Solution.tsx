import { Section, Screenshot } from "@/components/ui";

export function Solution() {
  return (
    <Section id="solution">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
          Tu ne regardes plus derrière. Tu sais ce qui vient.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-secondary sm:text-xl">
          Pulpe transforme tes prévisions en un disponible clair, mois après
          mois. Un imprévu arrive, la projection se recalcule.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-5xl">
        <Screenshot
          src="/screenshots/responsive/vue-calendrier-annuel.webp"
          desktopSrc="/screenshots/webapp/vue-calendrier-annuel.webp"
          label="Vue annuelle des budgets"
          mobileWidth={750}
          mobileHeight={1190}
          desktopWidth={1695}
          desktopHeight={1354}
        />
      </div>
    </Section>
  );
}
