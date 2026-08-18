import { SupportGuide } from "@/components/pages/SupportGuide";
import { supportGuideMetadata } from "@/components/pages/metadata";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export const generateMetadata = () => supportGuideMetadata(DEFAULT_LOCALE);

export default async function ModelsAndBudgetsGuidePage() {
  return (
    <SupportGuide
      dict={await getDictionary(DEFAULT_LOCALE)}
      locale={DEFAULT_LOCALE}
    />
  );
}
