import { Section } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";

export function Testimonials({
  dict,
}: {
  dict: Dictionary["home"]["testimonials"];
}) {
  return (
    <Section id="testimonials">
      <header className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-text sm:text-5xl">
          {dict.heading}
        </h2>
      </header>

      <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8 lg:mt-12 lg:gap-12">
        {dict.items.map((testimonial) => (
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
