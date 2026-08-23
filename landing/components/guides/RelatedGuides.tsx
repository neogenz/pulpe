import Link from "next/link";
import { getGuide, type Guide } from "./guides";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import {
  ADVICE_INDEX_ROUTE,
  CALCULATOR_LABEL_FR,
  CALCULATOR_ROUTE,
  localizedPath,
} from "@/lib/routes";
import { FR_GUIDE_CHROME } from "./chrome";

export function RelatedGuides({
  slugs,
  calculator = false,
  resolve = getGuide,
  sectionPath = ADVICE_INDEX_ROUTE,
  locale = DEFAULT_LOCALE,
  heading = FR_GUIDE_CHROME.relatedHeading,
}: {
  slugs: readonly string[];
  calculator?: boolean;
  resolve?: (slug: string) => Guide;
  sectionPath?: string;
  locale?: Locale;
  heading?: string;
}) {
  const related = slugs.map(resolve);
  const showCalculator = calculator && locale === DEFAULT_LOCALE;

  return (
    <>
      <h2>{heading}</h2>
      <ul>
        {related.map((guide) => (
          <li key={guide.slug}>
            <Link href={localizedPath(locale, `${sectionPath}/${guide.slug}`)}>
              {guide.title}
            </Link>
          </li>
        ))}
        {showCalculator ? (
          <li>
            <Link href={CALCULATOR_ROUTE}>{CALCULATOR_LABEL_FR}</Link>
          </li>
        ) : null}
      </ul>
    </>
  );
}
