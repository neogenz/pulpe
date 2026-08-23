import { SupportAssistant } from "@/components/pages/SupportAssistant";
import { supportAssistantMetadata } from "@/components/pages/metadata";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export const generateMetadata = () => supportAssistantMetadata(DEFAULT_LOCALE);

export default async function ConnectAssistantGuidePage() {
  return (
    <SupportAssistant
      dict={await getDictionary(DEFAULT_LOCALE)}
      locale={DEFAULT_LOCALE}
    />
  );
}
