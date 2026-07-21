import { Section } from "@/components/ui";

const STEPS = [
  {
    number: "01",
    title: "Renseigne un mois habituel",
    description:
      "Ajoute tes revenus, tes dépenses récurrentes et ce que tu veux mettre de côté.",
  },
  {
    number: "02",
    title: "Place ce qui change",
    description:
      "Ajoute les impôts, les vacances et les gros achats dans les mois où ils auront lieu.",
  },
  {
    number: "03",
    title: "Vois ce qu’il te restera",
    description:
      "Pulpe calcule ton disponible chaque mois. Quand tu ajoutes une dépense réelle, la suite se met à jour.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <header className="max-w-xl lg:col-span-4">
          <h2 className="balance text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
            Trois étapes pour voir plus loin.
          </h2>
          <p className="pretty mt-5 text-lg text-text-secondary">
            Pas de rapport à construire ni de formule à entretenir.
          </p>
        </header>

        <ol className="md:grid md:grid-cols-3 lg:col-span-8">
          {STEPS.map((step, index) => (
            <li
              key={step.number}
              className={`py-7 md:px-6 md:py-3 ${
                index > 0
                  ? "border-t border-text/10 md:border-l md:border-t-0"
                  : ""
              }`}
            >
              <span className="text-sm font-semibold text-primary">
                {step.number}
              </span>
              <h3 className="balance mt-3 text-xl font-semibold text-text">
                {step.title}
              </h3>
              <p className="pretty mt-3 text-sm leading-relaxed text-text-secondary">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
