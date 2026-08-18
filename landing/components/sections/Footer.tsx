import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { angularUrl, CONTACT_EMAIL, GITHUB_URL } from "@/lib/config";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import {
  ADVICE_LABEL_FR,
  ADVICE_INDEX_ROUTE,
  CALCULATOR_LABEL_FR,
  CALCULATOR_ROUTE,
  localizedPath,
  type Route,
} from "@/lib/routes";

type FooterLinkId = keyof Dictionary["footer"]["links"];

// Destination et nature du lien restent ici, seuls les libellés changent de
// langue. L'ordre des groupes et de leurs liens est l'ordre affiché.
const FOOTER_GROUPS = [
  {
    id: "discover",
    links: [
      {
        id: "guides",
        href: ADVICE_INDEX_ROUTE,
        internal: true,
        frenchOnly: true,
      },
      {
        id: "calculator",
        href: CALCULATOR_ROUTE,
        internal: true,
        frenchOnly: true,
      },
      { id: "changelog", href: "/changelog", internal: true },
      { id: "source", href: GITHUB_URL, external: true },
    ],
  },
  {
    id: "help",
    links: [
      { id: "support", href: "/support", internal: true },
      { id: "contact", href: `mailto:${CONTACT_EMAIL}` },
    ],
  },
  {
    id: "legal",
    links: [
      { id: "terms", href: "/legal/cgu", angular: true },
      { id: "privacy", href: "/legal/confidentialite", angular: true },
    ],
  },
] as const satisfies readonly {
  id: keyof Dictionary["footer"]["groups"];
  links: readonly {
    id: string;
    href: string;
    external?: boolean;
    internal?: boolean;
    frenchOnly?: boolean;
    angular?: boolean;
  }[];
}[];

const linkClassName =
  "inline-flex min-h-11 items-center rounded-md text-sm text-text-secondary transition-colors duration-200 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none";

export function Footer({
  dict,
  language,
  locale,
  route,
}: {
  dict: Dictionary["footer"];
  language: Dictionary["language"];
  locale: Locale;
  /** `null` sur une page qui n'existe qu'en français : rien vers quoi basculer. */
  route: Route | null;
}) {
  // Le libellé des guides ne vit pas dans les dictionnaires : la page qu'il
  // ouvre n'existe qu'en français, donc le lien ne s'affiche qu'en français et
  // une traduction resterait inatteignable.
  const labelOf = (id: string) => {
    if (id === "guides") return ADVICE_LABEL_FR;
    if (id === "calculator") return CALCULATOR_LABEL_FR;
    return dict.links[id as FooterLinkId];
  };
  return (
    <footer className="border-t border-text/10 bg-transparent py-12">
      <Container>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 text-xl font-bold text-text">
              <Image
                src="/icon-64.webp"
                alt=""
                width={32}
                height={32}
                className="size-8"
              />
              <span>Pulpe</span>
            </div>
            <p className="mt-2 text-sm font-medium text-text">{dict.tagline}</p>
          </div>

          <nav
            aria-label={dict.navAriaLabel}
            className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 sm:gap-x-12"
          >
            {FOOTER_GROUPS.map((group) => (
              <div key={group.id}>
                <h2 className="text-sm font-semibold text-text">
                  {dict.groups[group.id]}
                </h2>
                <ul className="mt-2">
                  {group.links
                    .filter(
                      (link) =>
                        !("frenchOnly" in link && link.frenchOnly) ||
                        locale === DEFAULT_LOCALE,
                    )
                    .map((link) => (
                      <li key={link.id}>
                        {"internal" in link && link.internal ? (
                          <Link
                            href={localizedPath(locale, link.href)}
                            className={linkClassName}
                          >
                            {labelOf(link.id)}
                          </Link>
                        ) : (
                          <a
                            href={
                              "angular" in link && link.angular
                                ? angularUrl(
                                    link.href,
                                    `footer_${link.id}`,
                                    locale,
                                  )
                                : link.href
                            }
                            className={linkClassName}
                            target={
                              "external" in link && link.external
                                ? "_blank"
                                : undefined
                            }
                            rel={
                              "external" in link && link.external
                                ? "noopener noreferrer"
                                : undefined
                            }
                          >
                            {labelOf(link.id)}
                          </a>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Groupe distinct des liens utiles : ces ancres ne mènent pas ailleurs
            dans le site, elles mènent à la même page dans une autre langue. */}
        {route !== null && (
          <div className="mt-6 border-t border-text/10 pt-4">
            <LanguageSwitcher dict={language} locale={locale} route={route} />
          </div>
        )}
      </Container>
    </footer>
  );
}
