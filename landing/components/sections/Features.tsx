import { PhoneMockup } from "@/components/ui";

export function Features() {
  return (
    <section
      id="features"
      className="scroll-mt-24 pb-24 min-[620px]:pb-32 min-[940px]:scroll-mt-28 min-[940px]:pb-40"
    >
      <div className="mx-auto flex w-full max-w-[var(--content-max)] flex-col gap-8 px-[var(--page-gutter)] min-[620px]:gap-12">
        <article className="product-panel product-panel--expense receipt-panel grid items-center gap-12 p-7 min-[620px]:p-12 min-[941px]:grid-cols-2 min-[941px]:gap-16 min-[941px]:p-16">
          <div
            className="product-copy reveal-right reveal-delay-1 relative z-10 min-[941px]:col-start-2 min-[941px]:row-start-1"
            data-reveal
          >
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-expense">
              Ce qui change
            </p>
            <h3 className="mt-4 max-w-xl text-[clamp(2.4rem,5vw,4.75rem)] font-[760] leading-[0.98] tracking-[-0.055em] text-text">
              Ajuste l&apos;exception. Ne repars jamais de zéro.
            </h3>
            <p className="pretty mt-6 max-w-lg text-lg leading-relaxed text-text-secondary">
              Pars de ton modèle, ajoute la dépense au mois concerné ou
              répartis-la sur plusieurs mois. Pulpe garde le même total et
              recalcule les soldes à venir.
            </p>
            <div
              className="mt-7 max-w-sm rounded-2xl border border-expense/15 bg-surface/75 p-4"
              aria-hidden="true"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-semibold text-text">
                  Assurance annuelle
                </span>
                <strong className="tabular-nums text-expense">
                  1’200 CHF
                </strong>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {["Mai", "Juin", "Juil.", "Août"].map((month) => (
                  <div key={month}>
                    <div className="h-1.5 rounded-full bg-expense/65" />
                    <p className="tabular-nums mt-2 text-xs font-bold text-text">
                      300
                    </p>
                    <p className="text-[0.6875rem] text-text-secondary">
                      {month}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className="phone-stage receipt-stage reveal-left relative z-10 mx-auto flex w-full justify-center min-[941px]:col-start-1 min-[941px]:row-start-1"
            data-reveal
          >
            <PhoneMockup
              src="/screenshots/ios/ecran-des-modeles.webp"
              alt="Écran des modèles de budget dans Pulpe sur iPhone"
              className="feature-phone w-[min(76vw,300px)] min-[621px]:w-[300px]"
            />
          </div>
        </article>

        <article className="product-panel product-panel--clarity insight-panel grid items-center gap-12 p-7 min-[620px]:p-12 min-[941px]:grid-cols-2 min-[941px]:gap-16 min-[941px]:p-16">
          <div
            className="product-copy reveal-left relative z-10 min-[941px]:col-start-1 min-[941px]:row-start-1"
            data-reveal
          >
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">
              Tes repères
            </p>
            <h3 className="mt-4 max-w-xl text-[clamp(2.4rem,5vw,4.75rem)] font-[760] leading-[0.98] tracking-[-0.055em] text-text">
              Vois ton disponible. Suis tes objectifs.
            </h3>
            <p className="pretty mt-6 max-w-lg text-lg leading-relaxed text-text-secondary">
              Compare prévu et réel, puis vois quelles épargnes font avancer
              chaque objectif. Un changement dans un mois reste visible dans
              les suivants.
            </p>
            <div
              className="mt-7 max-w-sm rounded-2xl bg-surface/78 p-4 ring-1 ring-primary/10"
              aria-hidden="true"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-text">Vacances</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Objectif septembre
                  </p>
                </div>
                <strong className="tabular-nums text-sm text-primary">
                  65 %
                </strong>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/12">
                <div className="h-full w-[65%] rounded-full bg-primary" />
              </div>
            </div>
          </div>

          <div
            className="phone-stage insight-stage reveal-right reveal-delay-1 relative z-10 mx-auto flex w-full justify-center min-[941px]:col-start-2 min-[941px]:row-start-1"
            data-reveal
          >
            <PhoneMockup
              src="/screenshots/ios/detail-du-budget.webp"
              alt="Détail d’un budget mensuel dans Pulpe sur iPhone"
              className="feature-phone w-[min(76vw,300px)] min-[621px]:w-[300px]"
            />
          </div>
        </article>
      </div>
    </section>
  );
}
