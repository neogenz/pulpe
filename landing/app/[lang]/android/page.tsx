import { AndroidBeta } from "@/components/pages/AndroidBeta";
import { androidBetaMetadata } from "@/components/pages/metadata";
import { getDictionary } from "@/content/dictionary";
import { assertPrefixedLocale } from "@/lib/i18n";

type LangParams = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: LangParams) {
  return androidBetaMetadata(assertPrefixedLocale((await params).lang));
}

export default async function AndroidBetaPage({ params }: LangParams) {
  const locale = assertPrefixedLocale((await params).lang);
  return <AndroidBeta dict={await getDictionary(locale)} locale={locale} />;
}
