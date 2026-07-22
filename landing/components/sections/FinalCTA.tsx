"use client";

import { Button, Container } from "@/components/ui";
import { angularUrl } from "@/lib/config";
import { trackCTAClick } from "@/lib/posthog";

export function FinalCTA() {
  return (
    <section className="py-24 sm:py-28 lg:py-36">
      <Container>
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-[clamp(2.75rem,7vw,6rem)] font-bold leading-[1.12] tracking-[-0.04em] text-text">
            Prépare ton année. Vois combien il te restera chaque mois.
          </h2>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-text/80 sm:text-xl">
            Commence gratuitement, sans connecter tes comptes bancaires. Tes
            montants sont chiffrés.
          </p>
          <Button
            href={angularUrl("/signup", "final_cta_commencer")}
            className="mt-10"
            onClick={() =>
              trackCTAClick("commencer_gratuitement", "final_cta", "/signup")
            }
          >
            Créer mon budget gratuitement
          </Button>
        </div>
      </Container>
    </section>
  );
}
