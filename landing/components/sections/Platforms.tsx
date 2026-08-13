import { Globe, Smartphone } from "lucide-react";
import { Badge, Button, Section } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";
import { angularUrl } from "@/lib/config";

const IOS_APP_URL = "https://apps.apple.com/app/pulpe/id6758464920";

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01ZM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

export function Platforms({ dict }: { dict: Dictionary["home"]["platforms"] }) {
  return (
    <Section id="platforms">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
          {dict.heading}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-text-secondary">
          {dict.intro}
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-5 lg:gap-8">
        {/* A corner glow used to sit here on `bg-lime/15`, a class with no
            token behind it, so it has rendered as nothing since it was
            written. Reinstating it with a real tint lifted this card's
            background under the paragraph below, dropping white/80 from
            4.72:1 to 3.94:1. The card reads fine flat, so it stays flat, and
            the positioning scaffolding it needed goes with it. */}
        <article className="rounded-[var(--radius-large)] bg-primary p-7 text-white sm:p-10 lg:col-span-3 lg:p-12">
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-white/12">
                <AppleLogo className="size-8" />
              </span>
              <span className="rounded-full bg-white/12 px-3 py-1 text-sm font-medium">
                {dict.ios.badge}
              </span>
            </div>
            {/* Même taille que « Dans ton navigateur » : les deux cartes sont
                des pairs dans la même rangée, et 36 contre 30px sur des titres
                de même niveau se lit comme un raté, pas comme une hiérarchie.
                La carte iPhone garde son poids par sa largeur et son fond. */}
            <h3 className="mt-10 text-3xl font-semibold tracking-[-0.03em]">
              {dict.ios.title}
            </h3>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-white/80">
              {dict.ios.text}
            </p>
            <a
              href={IOS_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-10 inline-flex w-fit rounded-xl transition-opacity duration-200 hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary motion-reduce:transition-none"
              aria-label={dict.ios.storeAriaLabel}
              data-cta-name="download_app_store"
              data-cta-location="platforms"
              data-cta-destination={IOS_APP_URL}
            >
              <img
                src="/app-store-badge.svg"
                alt={dict.ios.storeBadgeAlt}
                width={156}
                height={52}
                loading="lazy"
              />
            </a>
          </div>
        </article>

        <div className="flex flex-col rounded-[var(--radius-large)] bg-surface p-7 shadow-[var(--shadow-organic)] outline outline-1 -outline-offset-1 outline-black/5 sm:p-9 lg:col-span-2">
          <Globe className="size-7 text-primary" strokeWidth={1.7} />
          <h3 className="mt-6 text-3xl font-semibold tracking-[-0.025em]">
            {dict.web.title}
          </h3>
          <p className="mt-3 leading-relaxed text-text-secondary">
            {dict.web.text}
          </p>
          <Button
            href={angularUrl("/welcome", "platforms_ouvrir")}
            variant="secondary"
            className="mt-7 w-full"
            data-cta-name="ouvrir_navigateur"
            data-cta-location="platforms"
            data-cta-destination="/welcome"
          >
            {dict.web.cta}
          </Button>

          <div className="mt-8 border-t border-text/10 pt-7">
            <div className="flex items-center gap-3">
              <Smartphone
                className="size-5 text-text-secondary"
                strokeWidth={1.7}
              />
              {/* h4 : ce bloc est une note à l'intérieur de la carte web, pas un
                  pair de « Dans ton navigateur ». En h3 il annonçait au plan du
                  document une troisième plateforme au même rang que les deux
                  autres, et il apportait au rôle h3 une troisième taille. */}
              <h4 className="font-semibold">{dict.android.title}</h4>
              <Badge>{dict.android.badge}</Badge>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              {dict.android.text}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
