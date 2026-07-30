import Image from "next/image";
import { Button, PhoneMockup } from "@/components/ui";
import { angularUrl } from "@/lib/config";

export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="hero hero-aurora relative pb-20 pt-[calc(8.5rem+env(safe-area-inset-top))] min-[621px]:pb-28 min-[621px]:pt-[calc(10rem+env(safe-area-inset-top))] min-[941px]:min-h-[940px] min-[941px]:pb-24 min-[941px]:pt-[calc(9.5rem+env(safe-area-inset-top))]"
    >
      <div className="hero-inner relative z-10 mx-auto grid w-full max-w-[var(--content-max)] items-center gap-16 px-[var(--page-gutter)] min-[941px]:grid-cols-[minmax(0,1.03fr)_minmax(18rem,0.97fr)]">
        <div className="hero-copy text-center min-[941px]:text-left">
          <div className="hero-eyebrow hidden items-center min-[621px]:flex">
            <span className="hero-eyebrow-icon" aria-hidden="true">
              <Image
                src="/app-icon.webp"
                alt=""
                width={44}
                height={44}
                className="size-11"
              />
            </span>
            <span>Le budget tourné vers les mois qui viennent</span>
          </div>
          <h1 id="hero-title" className="text-text">
            <span className="block">Ton année.</span>
            <span className="block">Déjà</span>
            <span className="hero-title-last block">visible.</span>
          </h1>
          <p className="hero-description pretty mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-text-secondary min-[621px]:text-xl min-[941px]:mx-0 min-[941px]:max-w-xl">
            Prépare ton budget mois par mois et sais combien il te restera.
            Sans connexion bancaire ni tableur.
          </p>

          <div className="hero-actions mt-9 flex flex-col items-stretch justify-center gap-3 min-[621px]:flex-row min-[621px]:items-center min-[941px]:justify-start">
            <Button
              href={angularUrl("/signup", "hero_commencer")}
              className="hero-primary-status"
              data-cta-name="commencer"
              data-cta-location="hero"
              data-cta-destination="/signup"
            >
              Créer mon budget gratuitement
            </Button>
            <a className="hero-secondary-link" href="#features">
              Explorer Pulpe <span aria-hidden="true">↓</span>
            </a>
          </div>

          <p className="hero-privacy-note">
            <span aria-hidden="true" /> Gratuit, chiffré, sans connexion
            bancaire.
          </p>
        </div>

        <div className="hero-phone-stage relative mx-auto flex w-full justify-center min-[941px]:justify-end">
          <PhoneMockup
            src="/screenshots/ios/vue-annuelle-des-budgets.webp"
            alt="Vue annuelle des budgets dans Pulpe sur iPhone"
            priority
            className="hero-phone w-[min(78vw,360px)] min-[621px]:w-[350px] min-[941px]:w-[360px]"
          />
        </div>
      </div>
    </section>
  );
}
