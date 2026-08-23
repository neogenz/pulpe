import { SupportAssistant } from "@/components/pages/SupportAssistant";
import { supportAssistantMetadata } from "@/components/pages/metadata";
import { getDictionary } from "@/content/dictionary";
import { assertPrefixedLocale } from "@/lib/i18n";

type LangParams = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: LangParams) {
  return supportAssistantMetadata(assertPrefixedLocale((await params).lang));
}

export default async function ConnectAssistantGuidePage({
  params,
}: LangParams) {
  const locale = assertPrefixedLocale((await params).lang);
  return (
    <SupportAssistant dict={await getDictionary(locale)} locale={locale} />
  );
}
