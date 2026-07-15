"use client";

import { Button, Container, LimeWedge } from "@/components/ui";
import { angularUrl } from "@/lib/config";
import { trackCTAClick } from "@/lib/posthog";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_-20%,#4a9b50_0%,#1f7829_42%,#07541b_100%)] py-24 text-white sm:py-28 lg:py-36">
      <LimeWedge className="pointer-events-none absolute -bottom-24 -right-20 size-[22rem] text-white opacity-[0.07] sm:size-[30rem]" />
      <Container>
        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <p className="text-sm font-medium text-white/75">
            Ton année peut être claire dès aujourd&apos;hui
          </p>
          <h2 className="mt-5 text-[clamp(2.75rem,7vw,6rem)] font-bold leading-[0.98] tracking-[-0.05em]">
            Prends des mois d&apos;avance sur ce qu&apos;il te restera.
          </h2>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-white/75 sm:text-xl">
            Gratuit aujourd&apos;hui. Sans connexion bancaire. Tes montants sont
            chiffrés.
          </p>
          <Button
            href={angularUrl("/signup", "final_cta_commencer")}
            variant="inverse"
            className="focus-on-dark mt-10"
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
