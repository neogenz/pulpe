import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui";
import { ANGULAR_APP_URL, CONTACT_EMAIL, GITHUB_URL } from "@/lib/config";

const FOOTER_GROUPS = [
  {
    label: "Produit",
    links: [
      { label: "Fonctionnalités", href: "/#features", internal: true },
      { label: "Applications", href: "/#platforms", internal: true },
      { label: "Nouveautés", href: "/changelog", internal: true },
      { label: "Support", href: "/support", internal: true },
    ],
  },
  {
    label: "Légal",
    links: [
      { label: "Conditions", href: `${ANGULAR_APP_URL}/legal/cgu` },
      {
        label: "Confidentialité",
        href: `${ANGULAR_APP_URL}/legal/confidentialite`,
      },
      { label: "Code source", href: GITHUB_URL, external: true },
      { label: "Contact", href: `mailto:${CONTACT_EMAIL}` },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="site-footer border-t border-text/10 bg-surface-alt py-12 min-[940px]:py-16">
      <Container>
        <div className="footer-grid grid gap-10 min-[720px]:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div>
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

          {FOOTER_GROUPS.map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <p className="font-bold text-text">{group.label}</p>
              <ul className="mt-3 text-sm font-semibold text-text-secondary">
                {group.links.map((link) => {
                  const className =
                    "inline-flex min-h-11 items-center rounded-md transition-colors duration-200 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none";

                  return (
                    <li key={link.label}>
                      {"internal" in link && link.internal ? (
                        <Link href={link.href} className={className}>
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          className={className}
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
                  );
                })}
              </ul>
            </nav>
          ))}
        </div>
      </Container>
    </footer>
  );
}
