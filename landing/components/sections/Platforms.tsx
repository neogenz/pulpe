import { Button, PhoneMockup } from "@/components/ui";
import { angularUrl } from "@/lib/config";

const IOS_APP_URL = "https://apps.apple.com/app/pulpe/id6758464920";

export function Platforms() {
  return (
    <section
      id="platforms"
      className="platform-section scroll-mt-24 pb-24 min-[620px]:pb-32 min-[940px]:scroll-mt-28 min-[940px]:pb-40"
    >
      <div className="mx-auto w-full max-w-[var(--content-max)] px-[var(--page-gutter)]">
        <article className="platforms-dark dark-panel relative grid items-center gap-14 overflow-hidden rounded-[var(--radius-panel)] px-7 py-14 text-white min-[620px]:px-12 min-[620px]:py-20 min-[941px]:grid-cols-[1.05fr_0.95fr] min-[941px]:gap-12 min-[941px]:px-16 min-[941px]:py-20">
          <div
            className="dark-copy reveal-left relative z-10 text-center min-[941px]:text-left"
            data-reveal
          >
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#7ee2a0]">
              Mode sombre natif
            </p>
            <h2 className="mt-5 text-white">
              La même clarté, dans une lumière plus douce.
            </h2>
            <p className="pretty mx-auto mt-7 max-w-xl text-lg leading-relaxed text-white/72 min-[620px]:text-xl min-[941px]:mx-0">
              Pulpe suit l&apos;apparence de ton iPhone sans changer tes
              repères. Tes montants, tes catégories et ton disponible restent
              au même endroit.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-4 min-[620px]:flex-row min-[941px]:justify-start">
              <a
                href={IOS_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-xl transition-opacity duration-200 hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#141a14] motion-reduce:transition-none"
                aria-label="Télécharger Pulpe sur l’App Store"
                data-cta-name="download_app_store"
                data-cta-location="platforms"
                data-cta-destination={IOS_APP_URL}
              >
                <img
                  src="/app-store-badge.svg"
                  alt="Télécharger sur l’App Store"
                  width={156}
                  height={52}
                  loading="lazy"
                />
              </a>
              <Button
                href={angularUrl("/welcome", "platforms_ouvrir")}
                variant="inverse"
                data-cta-name="ouvrir_navigateur"
                data-cta-location="platforms"
                data-cta-destination="/welcome"
              >
                Ouvrir l&apos;app web
              </Button>
            </div>
          </div>

          <div
            className="dark-phone-wrap reveal-right reveal-delay-1 relative z-10 mx-auto flex w-full justify-center min-[941px]:justify-end"
            data-reveal
          >
            <PhoneMockup
              src="/screenshots/ios/tableau-de-bord-dark.webp"
              alt="Tableau de bord Pulpe en mode sombre sur iPhone"
              className="dark-phone w-[min(76vw,360px)] min-[621px]:w-[360px]"
            />
          </div>
        </article>
      </div>
    </section>
  );
}
