import { Support } from "@/components/pages/Support";
import { supportMetadata } from "@/components/pages/metadata";
import { getDictionary } from "@/content/dictionary";
import { assertPrefixedLocale } from "@/lib/i18n";

type LangParams = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: LangParams) {
  return supportMetadata(assertPrefixedLocale((await params).lang));
}

export default async function SupportPage({ params }: LangParams) {
  const locale = assertPrefixedLocale((await params).lang);
  return <Support dict={await getDictionary(locale)} locale={locale} />;
}
