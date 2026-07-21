import { Quote } from "lucide-react";
import { Section } from "@/components/ui";

const SUPPORTING_TESTIMONIALS = [
  {
    quote: "Je vois tout de suite où en est mon budget. C’est simple à suivre.",
  },
  {
    quote:
      "Je peux prévoir sorties et vacances sur l’année, puis voir si ça rentre dans notre budget.",
  },
] as const;

export function Testimonials() {
  return (
    <Section
      id="testimonials"
      background="surface"
      className="border-y border-text/10"
    >
      <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-16">
        <header className="lg:col-span-4">
          <h2 className="balance text-3xl font-bold leading-[1.05] tracking-[-0.035em] text-text sm:text-5xl">
            Leurs premiers retours.
          </h2>
        </header>

        <div className="lg:col-span-8">
          <blockquote className="border-t-2 border-primary pt-6">
            <div className="flex items-start gap-3">
              <Quote
                className="mt-1 size-6 shrink-0 text-primary"
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <p className="pretty text-lg font-medium leading-relaxed tracking-[-0.015em] text-text sm:text-2xl">
                Pulpe m&apos;a révélé des dépenses que je ne voyais pas venir.
                Maintenant, je sais mieux où j&apos;en suis.
              </p>
            </div>
            <footer className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 pl-9">
              <cite className="font-semibold not-italic text-text">Ismaël</cite>
              <span className="text-sm text-text-secondary">
                Utilisateur de Pulpe
              </span>
            </footer>
          </blockquote>

          <div className="mt-6 grid border-y border-text/10 sm:grid-cols-2">
            {SUPPORTING_TESTIMONIALS.map((testimonial, index) => (
              <blockquote
                key={testimonial.quote}
                className={`py-4 sm:py-6 ${
                  index > 0
                    ? "border-t border-text/10 sm:border-l sm:border-t-0 sm:pl-7"
                    : "sm:pr-7"
                }`}
              >
                <p className="pretty leading-relaxed text-text">
                  {testimonial.quote}
                </p>
                <footer className="mt-2">
                  <cite className="text-sm font-medium not-italic text-text-secondary">
                    Utilisatrice de Pulpe
                  </cite>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
