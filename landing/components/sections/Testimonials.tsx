import { Section, Signature } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";
import { TESTIMONIAL_SIGNATURES } from "./testimonialSignatures";

/* Guillemets « à main levée » : deux virgules d'encre penchées, dans le jaune
   preuve réservé aux témoignages. C'est le glyphe du genre, mais dessiné —
   jamais le caractère Poppins, qui lit comme des barres en grand. */
function QuoteDoodle() {
  return (
    <svg
      viewBox="0 0 44 34"
      aria-hidden="true"
      className="quote-doodle h-7 w-9 self-start"
    >
      <path d="M14 5 C11 11, 9.5 17, 10.5 27" />
      <path d="M30 4 C27 10, 25.5 16, 26.5 26" />
    </svg>
  );
}

export function Testimonials({
  dict,
}: {
  dict: Dictionary["home"]["testimonials"];
}) {
  return (
    <Section id="testimonials">
      <header className="max-w-xl">
        <p className="mb-3 font-semibold text-primary">{dict.eyebrow}</p>
        <h2 className="text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-text sm:text-5xl">
          {dict.heading}
        </h2>
      </header>

      {/* Les codes du genre — carte, glyphe de citation, pied identité — dans
          la grammaire de la page : porcelaine + filet, glyphe dessiné main,
          et la signature manuscrite à la place de l'avatar, encrée trait par
          trait au scroll. */}
      <div className="mt-10 grid gap-5 md:grid-cols-3 lg:mt-14 lg:gap-6">
        {dict.items.map((testimonial, index) => {
          const signature = TESTIMONIAL_SIGNATURES[testimonial.name];
          return (
            <blockquote
              key={testimonial.name}
              className="flex h-full flex-col rounded-[var(--radius-card)] bg-surface p-6 outline outline-1 -outline-offset-1 outline-black/5 sm:p-7"
            >
              <QuoteDoodle />
              <p className="pretty mb-6 mt-4 text-lg leading-[1.55] tracking-[-0.01em] text-text">
                {testimonial.lead}
                <mark className="marker-highlight marker-highlight-proof">
                  <strong className="font-semibold">
                    {testimonial.highlight}
                  </strong>
                </mark>
                {testimonial.tail}
              </p>
              <footer className="mt-auto border-t border-text/10 pt-5">
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
