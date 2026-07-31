import { Section } from "@/components/ui";

const TESTIMONIALS: {
  lead: string;
  highlight: string;
  tail: string;
  name: string;
  role?: string;
  since: string;
}[] = [
  {
    lead: "Je stresse moins. J’ai une vue d’ensemble, et ",
    highlight: "les dépenses que je ne voyais pas venir",
    tail: ", je les vois arriver maintenant.",
    name: "Ismaël S.",
    role: "Ingénieur en informatique",
    since: "Utilisateur depuis novembre 2025",
  },
  {
    lead: "Je vois tout de suite ",
    highlight: "où en est mon budget",
    tail: ". C’est pratique, clair et beaucoup plus simple à suivre.",
    name: "Sylvie G.",
    since: "Utilisatrice depuis mai 2026",
  },
  {
    lead: "Je peux ",
    highlight: "prévoir nos vacances sur l’année",
    tail: " et voir tout de suite si ça rentre dans notre budget. Ça me rassure.",
    name: "Julie D.",
    role: "Employée de commerce",
    since: "Utilisatrice depuis décembre 2025",
  },
];

export function Testimonials() {
  return (
    <Section id="testimonials">
      <header className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-text sm:text-5xl">
          Pourquoi ils utilisent Pulpe.
        </h2>
      </header>

      <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8 lg:mt-12 lg:gap-12">
        {TESTIMONIALS.map((testimonial) => (
          <blockquote
            key={testimonial.name}
            className="flex h-full flex-col text-left"
          >
            <p className="pretty flex-1 text-base leading-7 text-text">
              {testimonial.lead}
              <mark className="marker-highlight marker-highlight-proof">
                <strong className="font-semibold">
                  {testimonial.highlight}
                </strong>
              </mark>
              {testimonial.tail}
            </p>
            <footer className="mt-6">
              <span className="text-base font-semibold text-text">
                {testimonial.name}
              </span>
              {testimonial.role && (
                <span className="mt-0.5 block text-sm leading-snug text-text-secondary">
                  {testimonial.role}
                </span>
              )}
              <span className="mt-0.5 block text-sm leading-snug text-text-secondary">
                {testimonial.since}
              </span>
            </footer>
          </blockquote>
        ))}
      </div>
    </Section>
  );
}
