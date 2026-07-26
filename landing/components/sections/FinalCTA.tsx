import { ArrowNote, Button, Container } from "@/components/ui";
import { angularUrl } from "@/lib/config";

export function FinalCTA() {
  return (
    <section id="final-cta" className="py-24 sm:py-28 lg:py-36">
      <Container>
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-[clamp(2.75rem,7vw,6rem)] font-bold leading-[1.12] tracking-[-0.04em] text-text">
            Prépare ton année. Vois combien il te restera chaque mois.
          </h2>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-text/80 sm:text-xl">
            Commence gratuitement, sans connecter tes comptes bancaires. Tes
            montants sont chiffrés.
          </p>
          <div className="relative mt-32 inline-block md:mt-28">
            <ArrowNote className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 md:-mb-10 md:left-auto md:right-0 md:translate-x-38" />
            <Button
              href={angularUrl("/signup", "final_cta_commencer")}
              data-cta-name="commencer_gratuitement"
              data-cta-location="final_cta"
              data-cta-destination="/signup"
            >
              Créer mon budget gratuitement
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
