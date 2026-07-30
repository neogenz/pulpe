const budgetRows = [
  { label: "Revenus", amount: "+4’800 CHF", color: "text-accent" },
  { label: "Dépenses récurrentes", amount: "−2’900 CHF", color: "text-expense" },
  { label: "Épargne prévue", amount: "−600 CHF", color: "text-primary" },
];

export function Solution() {
  return (
    <section
      id="solution"
      className="solution-section scroll-mt-24 py-24 min-[620px]:py-32 min-[940px]:scroll-mt-28 min-[940px]:py-40"
    >
      <div className="mx-auto w-full max-w-[var(--content-max)] px-[var(--page-gutter)]">
        <header
          className="feature-intro reveal-up mx-auto max-w-4xl text-center"
          data-reveal
        >
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">
            Comment ça marche
          </p>
          <h2 className="mt-5 text-text">
            Un mois habituel. Toute ton année devant toi.
          </h2>
          <p className="pretty mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-text-secondary min-[620px]:text-xl">
            Pulpe transforme tes revenus, tes dépenses récurrentes et ton
            épargne en une projection claire. Chaque mois reste ajustable.
          </p>
        </header>

        <article className="product-panel product-panel--model shared-panel mt-16 grid items-center gap-12 p-7 min-[620px]:mt-24 min-[620px]:p-12 min-[941px]:grid-cols-2 min-[941px]:gap-16 min-[941px]:p-16">
          <div className="product-copy reveal-left relative z-10" data-reveal>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">
              Mois type
            </p>
            <h3 className="mt-4 max-w-xl text-[clamp(2.4rem,5vw,4.75rem)] font-[760] leading-[0.98] tracking-[-0.055em] text-text">
              Ton mois type prépare les douze suivants.
            </h3>
            <p className="pretty mt-6 max-w-lg text-lg leading-relaxed text-text-secondary">
              Renseigne ce qui revient. Pulpe prépare l&apos;année, puis tu
              ajustes les vacances, les impôts ou un changement de revenu au
              bon endroit.
            </p>
          </div>

          <div
            className="model-visual reveal-right reveal-delay-1 relative z-10 mx-auto w-full max-w-md rounded-[2rem] border border-white/80 bg-surface/92 p-5 shadow-[0_24px_70px_rgba(0,60,20,0.12)] min-[620px]:p-7"
            aria-hidden="true"
            data-reveal
          >
            <div className="flex items-center justify-between border-b border-text/10 pb-5">
              <div>
                <p className="text-sm font-bold text-text">Mon mois type</p>
                <p className="mt-1 text-xs text-text-secondary">
                  Base des prochains mois
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                Actif
              </span>
            </div>
            <div className="divide-y divide-text/8">
              {budgetRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <span className="text-sm font-medium text-text-secondary">
                    {row.label}
                  </span>
                  <strong
                    className={`tabular-nums text-sm font-bold ${row.color}`}
                  >
                    {row.amount}
                  </strong>
                </div>
              ))}
            </div>
            <div className="model-progress">
              <span />
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-primary px-4 py-4 text-on-primary">
              <span className="text-2xl font-bold tabular-nums">12</span>
              <span className="text-sm font-semibold">
                mois préparés et toujours ajustables
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
