export interface SourcedFigure {
  /** Amount as printed by the source, unit included: "393.30 CHF". */
  value: string;
  /** Year-over-year change printed beside the value: "+4,4 %". */
  change?: string;
  label: string;
}

export interface SourcedFiguresProps {
  figures: readonly SourcedFigure[];
  source: { label: string; href: string };
}

// An official figure never sits loose in the prose: it gets its own surface
// and its primary source right under it, so the reader can check it in one
// click.
export function SourcedFigures({ figures, source }: SourcedFiguresProps) {
  return (
    <figure className="guide-figures">
      <dl>
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt>{figure.label}</dt>
            <dd className="tabular-nums">
              {figure.value}
              {figure.change ? (
                <span className="guide-figures-change">{figure.change}</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      <figcaption>
        Source&nbsp;:{" "}
        <a href={source.href} target="_blank" rel="noopener noreferrer">
          {source.label}
        </a>
      </figcaption>
    </figure>
  );
}
