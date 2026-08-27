import { Section } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";

export function Testimonials({
  dict,
}: {
  dict: Dictionary["home"]["testimonials"];
}) {
  return (
    <Section id="testimonials">
      {/* Un seul panneau menthe regroupe les trois voix — la « menthe de
          regroupement » de la palette, pas trois cartes. À l'intérieur, le
          signifiant de la citation reste typographique : un guillemet anglais
          courbe au jaune preuve, la phrase intacte avec son extrait au feutre,
          puis l'attribution éditoriale au tiret. */}
      <div className="rounded-[var(--radius-large)] bg-surface-alt px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        <header className="max-w-xl">
          <h2 className="text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-text sm:text-5xl">
            {dict.heading}
          </h2>
        </header>

        <div className="mt-10 grid gap-12 md:grid-cols-3 md:gap-8 lg:mt-12 lg:gap-12">
          {dict.items.map((testimonial) => (
            <blockquote key={testimonial.name} className="flex h-full flex-col">
              <span
                aria-hidden="true"
                className="block select-none text-[4rem] leading-[0.55] font-bold text-[var(--color-marker-highlight-proof)]"
              >
                “
              </span>
              <p className="pretty mt-4 text-lg leading-relaxed text-text">
                {testimonial.lead}
                <mark className="marker-highlight marker-highlight-proof">
                  <strong className="font-semibold">
                    {testimonial.highlight}
                  </strong>
                </mark>
                {testimonial.tail}
              </p>
              <footer className="mt-auto pt-6">
                <span className="block text-base font-semibold leading-snug text-text">
                  — {testimonial.name}
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
      </div>
    </Section>
  );
}
