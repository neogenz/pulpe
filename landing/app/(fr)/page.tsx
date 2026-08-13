import { Home } from "@/components/pages/Home";
import { homeMetadata } from "@/components/pages/metadata";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export const generateMetadata = () => homeMetadata(DEFAULT_LOCALE);

export default async function LandingPage() {
  return (
    <Home dict={await getDictionary(DEFAULT_LOCALE)} locale={DEFAULT_LOCALE} />
  );
}
