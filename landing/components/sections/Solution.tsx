import { Section } from "@/components/ui";
import { HowItWorks } from "./HowItWorks";

export function Solution() {
  return (
    <Section id="solution">
      <div
        id="how-it-works"
        className="mx-auto max-w-3xl scroll-mt-24 text-center lg:scroll-mt-28"
      >
        <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
          Pars d&apos;un mois type.{" "}
          <mark className="marker-highlight marker-highlight-strong">
            Pulpe projette la suite.
          </mark>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-secondary sm:text-xl">
          Tu pars d&apos;un mois habituel. Pulpe s&apos;en sert pour préparer
          les suivants. Ensuite, tu places les impôts, les vacances et les gros
          achats dans les mois concernés.
        </p>
      </div>

      <HowItWorks />
    </Section>
  );
}
