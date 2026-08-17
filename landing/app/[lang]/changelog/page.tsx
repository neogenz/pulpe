import { Changelog } from "@/components/pages/Changelog";
import { changelogMetadata } from "@/components/pages/metadata";
import { getDictionary } from "@/content/dictionary";
import { assertPrefixedLocale } from "@/lib/i18n";

type LangParams = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: LangParams) {
  return changelogMetadata(assertPrefixedLocale((await params).lang));
}

export default async function ChangelogPage({ params }: LangParams) {
  const locale = assertPrefixedLocale((await params).lang);
  return <Changelog dict={await getDictionary(locale)} locale={locale} />;
}
