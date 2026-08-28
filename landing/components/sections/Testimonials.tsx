import { Section, Signature } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";
import { TESTIMONIAL_SIGNATURES } from "./testimonialSignatures";

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

      {/* Trois mots signés sur la feuille : la citation reste courte, et c'est
          la signature manuscrite — encrée trait par trait au scroll, comme le
          feutre et la flèche griffonnée — qui dit « témoignage » au premier
          regard, sans carte ni décor. */}
      <div className="mt-10 grid gap-14 md:grid-cols-3 md:gap-8 lg:mt-14 lg:gap-12">
        {dict.items.map((testimonial, index) => {
          const signature = TESTIMONIAL_SIGNATURES[testimonial.name];
          return (
            <blockquote key={testimonial.name}>
              <p className="pretty text-lg leading-[1.55] tracking-[-0.01em] text-text sm:text-xl">
                {testimonial.lead}
                <mark className="marker-highlight marker-highlight-proof">
                  <strong className="font-semibold">
                    {testimonial.highlight}
                  </strong>
                </mark>
                {testimonial.tail}
              </p>
              <footer className="mt-6">
                {signature ? (
                  <Signature
                    name={testimonial.name}
                    data={signature}
                    delay={index * 0.35}
                  />
                ) : (
                  <p className="font-semibold text-text">{testimonial.name}</p>
                )}
                <p className="mt-2 text-sm leading-snug text-text-secondary">
                  {testimonial.since}
                </p>
              </footer>
            </blockquote>
          );
        })}
      </div>
    </Section>
  );
}
