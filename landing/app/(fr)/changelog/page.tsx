import { Changelog } from "@/components/pages/Changelog";
import { changelogMetadata } from "@/components/pages/metadata";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export const generateMetadata = () => changelogMetadata(DEFAULT_LOCALE);

export default async function ChangelogPage() {
  return (
    <Changelog
      dict={await getDictionary(DEFAULT_LOCALE)}
      locale={DEFAULT_LOCALE}
    />
  );
}
