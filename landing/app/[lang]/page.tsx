import { Home } from "@/components/pages/Home";
import { homeMetadata } from "@/components/pages/metadata";
import { getDictionary } from "@/content/dictionary";
import { assertPrefixedLocale } from "@/lib/i18n";

type LangParams = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: LangParams) {
  return homeMetadata(assertPrefixedLocale((await params).lang));
}

export default async function LandingPage({ params }: LangParams) {
  const locale = assertPrefixedLocale((await params).lang);
  return <Home dict={await getDictionary(locale)} locale={locale} />;
}
