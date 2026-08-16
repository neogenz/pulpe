import { AccordionItem, Section } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";

// Le prix est la question qui décide, donc sa réponse est ouverte : six lignes
// repliées juste avant le CTA final se lisent comme un mur, pas comme une
// réassurance. La question sécurité n'est pas ouverte ici parce que le CTA final
// porte désormais l'essentiel de sa réponse, à l'endroit où on hésite.
// C'est une décision de mise en page, valable dans les quatre langues, donc
// c'est un rang dans la liste et non une clé du catalogue.
const OPEN_BY_DEFAULT_INDEX = 1;

export function FAQ({ dict }: { dict: Dictionary["home"]["faq"] }) {
  return (
    <Section id="faq">
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
