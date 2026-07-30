import Image from "next/image";
import { Button, Container } from "@/components/ui";
import { angularUrl } from "@/lib/config";

export function FinalCTA() {
  return (
    <section id="final-cta" className="final-section py-10 lg:py-15">
      <Container>
        <div
          className="final-card reveal-up relative mx-auto max-w-6xl overflow-hidden rounded-[var(--radius-panel)] bg-primary px-5 py-14 text-center text-white min-[620px]:px-10 min-[940px]:py-20"
          data-reveal
        >
          <div
            className="absolute -top-28 -right-20 size-72 rounded-full bg-white/10"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-36 -left-20 size-80 rounded-full bg-black/10"
            aria-hidden="true"
          />
          <Image
            src="/icon-192.png"
            alt=""
            width={86}
            height={86}
            className="final-icon relative mx-auto size-[86px] drop-shadow-lg"
          />
          <h2 className="relative mx-auto mt-7 max-w-4xl">
            Ton année peut commencer par un mois simple.
          </h2>
          <p className="relative mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80 min-[620px]:text-xl">
            Crée ton premier budget gratuitement et vois les mois qui viennent
            avec plus de calme.
          </p>
          <div className="relative mt-9 flex flex-wrap items-center justify-center gap-6">
            <Button
              href={angularUrl("/signup", "final_cta_commencer")}
              className="hero-primary-status"
              data-cta-name="commencer_gratuitement"
              data-cta-location="final_cta"
              data-cta-destination="/signup"
            >
              Créer mon budget gratuitement
            </Button>
            <a
              href={angularUrl("/welcome", "final_cta_demo")}
              className="hero-secondary-link"
              data-cta-name="essayer_demo"
              data-cta-location="final_cta"
              data-cta-destination="/welcome"
            >
              Essayer la démo <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
