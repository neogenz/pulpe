import { Section } from "@/components/ui";

const TESTIMONIALS = [
  {
    lead: "Pulpe m’a révélé ",
    highlight: "des dépenses que je ne voyais pas venir",
    tail: ". Maintenant, je sais mieux où j’en suis.",
    name: "Ismaël",
    role: "Utilisateur de Pulpe",
  },
  {
    lead: "Je vois tout de suite ",
    highlight: "où en est mon budget",
    tail: ". C’est pratique, clair et beaucoup plus simple à suivre.",
    name: "Une utilisatrice de Pulpe",
    role: "Suivi du budget",
  },
  {
    lead: "Je peux ",
    highlight: "prévoir sorties et vacances sur l’année",
    tail: ", puis voir tout de suite si ça rentre dans notre budget.",
    name: "Une utilisatrice de Pulpe",
    role: "Organisation de l’année",
  },
] as const;

export function Testimonials() {
  return (
    <Section id="testimonials">
      <header className="mx-auto max-w-2xl text-center">
        <h2 className="balance text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-text sm:text-5xl">
          Pourquoi ils utilisent Pulpe.
        </h2>
      </header>

      <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8 lg:mt-12 lg:gap-12">
        {TESTIMONIALS.map((testimonial) => (
          <blockquote
            key={testimonial.role}
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
              <cite className="text-base font-semibold not-italic text-text">
                {testimonial.name}
              </cite>
              <span className="mt-0.5 block text-sm leading-snug text-text-secondary">
                {testimonial.role}
              </span>
            </footer>
          </blockquote>
        ))}
      </div>
    </Section>
  );
}
