import { Section } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";

/* Le décalage vertical casse la silhouette de pavé : trois voix qui flottent
   en vague, pas une grille de texte. */
const STAGGER = ["", "md:mt-14", "md:mt-28"] as const;

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

      {/* Aucun décor inventé : la présence vient de l'échelle pull-quote et
          du blanc. Guillemets dans la copie avec la typographie de chaque
          langue (« … » suisses, “…” anglais), feutre preuve sur l'extrait,
          et une attribution d'une seule ligne pour garder le bloc léger. */}
      <div className="mt-10 grid gap-12 md:grid-cols-3 md:gap-8 lg:mt-14 lg:gap-12">
        {dict.items.map((testimonial, index) => (
          <blockquote key={testimonial.name} className={STAGGER[index]}>
            <p className="pretty text-xl leading-[1.45] tracking-[-0.01em] text-text sm:text-2xl">
              {testimonial.lead}
              <mark className="marker-highlight marker-highlight-proof">
                <strong className="font-semibold">
                  {testimonial.highlight}
                </strong>
              </mark>
              {testimonial.tail}
            </p>
            <footer className="mt-5 text-sm leading-snug text-text-secondary">
              <span className="font-semibold text-text">
                — {testimonial.name}
              </span>
              {" · "}
              {testimonial.since}
            </footer>
          </blockquote>
        ))}
      </div>
    </Section>
  );
}
