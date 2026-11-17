import { AndroidBeta } from "@/components/pages/AndroidBeta";
import { androidBetaMetadata } from "@/components/pages/metadata";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export const generateMetadata = () => androidBetaMetadata(DEFAULT_LOCALE);

export default async function AndroidBetaPage() {
  return (
    <AndroidBeta
      dict={await getDictionary(DEFAULT_LOCALE)}
      locale={DEFAULT_LOCALE}
    />
  );
}
