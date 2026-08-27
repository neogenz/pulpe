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

      {/* Aucun décor inventé : les guillemets vivent dans la copie, avec la
          typographie de chaque langue (« … » suisses, “…” anglais), le feutre
          preuve marque l'extrait, et l'attribution prend le tiret éditorial.
          mt-auto aligne les pieds entre colonnes de même hauteur. */}
      <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8 lg:mt-12 lg:gap-12">
        {dict.items.map((testimonial) => (
          <blockquote key={testimonial.name} className="flex h-full flex-col">
            <p className="pretty text-lg leading-relaxed text-text">
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
    </Section>
  );
}
