/**
 * Une marche à suivre numérotée. La numérotation est portée par le `ol` pour
 * les lecteurs d'écran et redessinée en pastille pour l'oeil, d'où le
 * `aria-hidden` sur le chiffre visible : sans lui, chaque étape s'annonce deux
 * fois.
 */
export function Steps({ items }: { items: readonly string[] }) {
  return (
    <ol className="mt-7 space-y-5">
      {items.map((item, index) => (
        <li key={item} className="flex gap-4">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          >
            {index + 1}
          </span>
          <p className="pt-0.5 leading-relaxed text-text-secondary">{item}</p>
        </li>
      ))}
    </ol>
  );
}
