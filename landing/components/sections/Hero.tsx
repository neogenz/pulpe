import { Button, HeroDashboard } from "@/components/ui";
import { angularUrl } from "@/lib/config";

export function Hero() {
  return (
    <section
      id="hero"
      className="hero-mesh relative overflow-hidden pb-12 pt-[calc(9rem+env(safe-area-inset-top))] md:pb-28 md:pt-[calc(10rem+env(safe-area-inset-top))] lg:pb-20 lg:pt-[calc(8rem+env(safe-area-inset-top))]"
    >
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 md:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="mx-auto max-w-5xl text-[clamp(2.75rem,5.6vw,5rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-text">
            Tu sais des mois à l&apos;avance{" "}
            <mark className="marker-highlight marker-highlight-strong">
              combien il te restera.
            </mark>
          </h1>
          <p className="pretty mx-auto mt-7 max-w-3xl text-lg leading-relaxed text-text-secondary md:text-xl">
            Planifie ton budget{" "}
            <strong className="font-semibold text-text">
              sur l&apos;année
            </strong>
            . Tu vois combien il te restera chaque mois pour préparer tes
            projets plus sereinement.
          </p>
          <div className="mt-9 flex justify-center">
            <Button
              href={angularUrl("/signup", "hero_commencer")}
              glow
              data-cta-name="commencer"
              data-cta-location="hero"
              data-cta-destination="/signup"
            >
              Créer mon budget gratuitement
            </Button>
          </div>
          <p className="mt-4 text-center text-sm text-text-secondary">
            Gratuit · Montants chiffrés · Aucune connexion bancaire
          </p>
        </div>

        {/* The dashboard is the proof: on a 900px-tall laptop its header and
            available-this-month figure have to clear the fold, so lg trades
            hero air for that. The h1 alone runs three 80px lines there. */}
        <div className="mx-auto mt-14 max-w-5xl md:mt-18 lg:mt-8">
          <HeroDashboard />
        </div>
      </div>
    </section>
  );
}
