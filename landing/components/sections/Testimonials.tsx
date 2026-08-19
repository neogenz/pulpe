import { Section } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";

export function Testimonials({
  dict,
}: {
  dict: Dictionary["home"]["testimonials"];
}) {
  return (
    <Section id="testimonials">
      <header className="max-w-xl">
        <h2 className="text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-text sm:text-5xl">
          {dict.heading}
        </h2>
      </header>

      {/* Le signifiant classique du témoignage, traité au feutre : un grand
          guillemet jaune preuve en ancre, la phrase intacte avec son extrait
          surligné, puis la personne — médaillon d'initiale, nom, ancienneté.
          Les pieds s'alignent grâce à mt-auto sur des cartes de même hauteur. */}
      <div className="mt-12 grid gap-5 md:mt-16 md:grid-cols-3 md:gap-8">
        {dict.items.map((testimonial) => (
          <blockquote
            key={testimonial.name}
            className="flex h-full flex-col rounded-[var(--radius-large)] bg-surface p-6 outline outline-1 -outline-offset-1 outline-black/5 sm:p-8"
          >
            <span
              aria-hidden="true"
              className="testimonial-glyph -ml-1 select-none text-[4.5rem] leading-[0.7] font-extrabold text-[var(--color-marker-highlight-proof)]"
            >
              «
            </span>
            <p className="pretty mt-5 text-lg leading-relaxed text-text">
              {testimonial.lead}
              <mark className="marker-highlight marker-highlight-proof">
                <strong className="font-semibold">
                  {testimonial.highlight}
                </strong>
              </mark>
              {testimonial.tail}
            </p>
            <footer className="mt-auto flex items-start gap-3 pt-7">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-alt text-sm font-semibold text-primary"
              >
                {testimonial.name.charAt(0)}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold leading-snug text-text">
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
              </span>
            </footer>
          </blockquote>
        ))}
      </div>
    </Section>
  );
}
