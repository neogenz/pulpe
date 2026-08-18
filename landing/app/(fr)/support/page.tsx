import { Support } from "@/components/pages/Support";
import { supportMetadata } from "@/components/pages/metadata";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export const generateMetadata = () => supportMetadata(DEFAULT_LOCALE);

export default async function SupportPage() {
  return (
    <Support
      dict={await getDictionary(DEFAULT_LOCALE)}
      locale={DEFAULT_LOCALE}
    />
  );
}
