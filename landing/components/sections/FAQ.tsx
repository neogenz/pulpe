import { AccordionItem, Section } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";

// Le prix est la question qui décide, donc sa réponse est ouverte : les
// autres lignes repliées juste avant le CTA final se lisent comme un mur.
// C'est une décision de mise en page, valable dans les quatre langues, donc
// c'est un rang dans la liste et non une clé du catalogue.
const OPEN_BY_DEFAULT_INDEX = 2;

export function FAQ({ dict }: { dict: Dictionary["home"]["faq"] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: dict.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <Section id="faq">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="mx-auto max-w-3xl">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
            {dict.heading}
          </h2>
        </div>
        <div className="mt-10 space-y-3">
          {dict.items.map((item, index) => (
            <AccordionItem
              key={item.question}
              question={item.question}
              answer={item.answer}
              defaultOpen={index === OPEN_BY_DEFAULT_INDEX}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
