import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui";
import { ANGULAR_APP_URL, CONTACT_EMAIL, GITHUB_URL } from "@/lib/config";

const FOOTER_GROUPS = [
  {
    title: "Découvrir",
    links: [
      { label: "Conseils budget", href: "/conseils-budget", internal: true },
      { label: "Nouveautés", href: "/changelog", internal: true },
      { label: "Code source", href: GITHUB_URL, external: true },
    ],
  },
  {
    title: "Aide",
    links: [
      { label: "FAQ et tutoriels", href: "/support", internal: true },
      { label: "Contact", href: `mailto:${CONTACT_EMAIL}` },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Conditions", href: `${ANGULAR_APP_URL}/legal/cgu` },
      {
        label: "Confidentialité",
        href: `${ANGULAR_APP_URL}/legal/confidentialite`,
      },
    ],
  },
] as const;

const linkClassName =
  "inline-flex min-h-11 items-center rounded-md text-sm text-text-secondary transition-colors duration-200 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none";

export function Footer() {
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
            <p className="mt-2 text-sm font-medium text-text">
              Le budget tourné vers les mois qui viennent. Créé en Suisse.
            </p>
          </div>

          <nav
            aria-label="Liens utiles"
            className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 sm:gap-x-12"
          >
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title}>
                <h2 className="text-sm font-semibold text-text">
                  {group.title}
                </h2>
                <ul className="mt-2">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      {"internal" in link && link.internal ? (
                        <Link href={link.href} className={linkClassName}>
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
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
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
