import Link from "next/link";
import { getGuide } from "./guides";
import { CALCULATOR_LABEL_FR, CALCULATOR_ROUTE } from "@/lib/routes";

export function RelatedGuides({
  slugs,
  calculator = false,
}: {
  slugs: readonly string[];
  calculator?: boolean;
}) {
  const related = slugs.map(getGuide);

  return (
    <>
      <h2>Continue avec…</h2>
      <ul>
        {related.map((guide) => (
          <li key={guide.slug}>
            <Link href={`/conseils-budget/${guide.slug}`}>{guide.title}</Link>
          </li>
        ))}
        {calculator ? (
          <li>
            <Link href={CALCULATOR_ROUTE}>{CALCULATOR_LABEL_FR}</Link>
          </li>
        ) : null}
      </ul>
    </>
  );
}
