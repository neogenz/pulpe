import { SupportGuide } from "@/components/pages/SupportGuide";
import { supportGuideMetadata } from "@/components/pages/metadata";
import { getDictionary } from "@/content/dictionary";
import { assertPrefixedLocale } from "@/lib/i18n";

type LangParams = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: LangParams) {
  return supportGuideMetadata(assertPrefixedLocale((await params).lang));
}

export default async function ModelsAndBudgetsGuidePage({
  params,
}: LangParams) {
  const locale = assertPrefixedLocale((await params).lang);
  return <SupportGuide dict={await getDictionary(locale)} locale={locale} />;
}
