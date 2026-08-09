import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui";
import { ANGULAR_APP_URL, CONTACT_EMAIL, GITHUB_URL } from "@/lib/config";

const FOOTER_LINKS = [
  { label: "Code source", href: GITHUB_URL, external: true },
  { label: "Conditions", href: `${ANGULAR_APP_URL}/legal/cgu` },
  {
    label: "Confidentialité",
    href: `${ANGULAR_APP_URL}/legal/confidentialite`,
  },
  { label: "Nouveautés", href: "/changelog", internal: true },
  { label: "Aide", href: "/support", internal: true },
  { label: "Contact", href: `mailto:${CONTACT_EMAIL}` },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-text/10 bg-transparent py-10">
      <Container>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
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

          <nav
            aria-label="Liens utiles"
            className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-text"
          >
            {FOOTER_LINKS.map((link) => {
              const className =
                "inline-flex min-h-11 min-w-11 items-center rounded-md transition-colors duration-200 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none lg:items-end";

              if ("internal" in link && link.internal) {
                return (
                  <Link key={link.label} href={link.href} className={className}>
                    {link.label}
                  </Link>
                );
              }

              return (
                <a
                  key={link.label}
                  href={link.href}
                  className={className}
                  target={
                    "external" in link && link.external ? "_blank" : undefined
                  }
                  rel={
                    "external" in link && link.external
                      ? "noopener noreferrer"
                      : undefined
                  }
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
