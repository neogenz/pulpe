import { Section, Screenshot } from "@/components/ui";

export function Solution() {
  return (
    <Section id="solution">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
          Pose un mois type. Pulpe projette la suite.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-secondary sm:text-xl">
          Tu poses une base, ajoutes ce qui change au bon mois, puis Pulpe
          reporte chaque surplus ou déficit sur les mois suivants.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-5xl">
        <Screenshot
          src="/screenshots/responsive/vue-calendrier-annuel.webp"
          desktopSrc="/screenshots/webapp/vue-calendrier-annuel.webp"
          label="Vue annuelle du budget"
          mobileWidth={750}
          mobileHeight={1190}
          desktopWidth={1695}
          desktopHeight={1354}
        />
      </div>
    </Section>
  );
}
