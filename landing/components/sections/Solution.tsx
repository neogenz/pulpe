import { Section } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";
import { HowItWorks } from "./HowItWorks";

export function Solution({
  dict,
  howItWorksDict,
}: {
  dict: Dictionary["home"]["solution"];
  howItWorksDict: Dictionary["home"]["howItWorks"];
}) {
  return (
    <Section id="solution">
      <div
        id="how-it-works"
        className="mx-auto max-w-3xl scroll-mt-24 text-center lg:scroll-mt-28"
      >
        <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
          {dict.headingLead}
          <mark className="marker-highlight marker-highlight-strong">
            {dict.headingHighlight}
          </mark>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-secondary sm:text-xl">
          {dict.intro}
        </p>
      </div>

      <HowItWorks dict={howItWorksDict} />
    </Section>
  );
}
