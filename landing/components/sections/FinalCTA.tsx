"use client";

import { Button, Container } from "@/components/ui";
import { angularUrl } from "@/lib/config";
import { trackCTAClick } from "@/lib/posthog";

export function FinalCTA() {
  return (
    <section className="py-24 sm:py-28 lg:py-36">
      <Container>
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-medium text-primary">
            Ton année peut être claire dès aujourd&apos;hui
          </p>
          <h2 className="mt-5 text-[clamp(2.75rem,7vw,6rem)] font-bold leading-[0.98] tracking-[-0.05em] text-text">
            Prends des mois d&apos;avance sur ce qu&apos;il te restera.
          </h2>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-text/80 sm:text-xl">
            Gratuit aujourd&apos;hui. Sans connexion bancaire. Tes montants sont
            chiffrés.
          </p>
          <Button
            href={angularUrl("/signup", "final_cta_commencer")}
            className="mt-10"
            onClick={() =>
              trackCTAClick("commencer_gratuitement", "final_cta", "/signup")
            }
          >
            Commencer gratuitement
          </Button>
        </div>
      </Container>
    </section>
  );
}
