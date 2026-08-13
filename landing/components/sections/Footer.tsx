import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";
import { ANGULAR_APP_URL, CONTACT_EMAIL, GITHUB_URL } from "@/lib/config";

// Destination et nature du lien restent ici, seul le libellé change de langue.
// L'ordre du tableau est l'ordre affiché.
const FOOTER_LINKS = [
  { id: "source", href: GITHUB_URL, external: true },
  { id: "terms", href: `${ANGULAR_APP_URL}/legal/cgu` },
  { id: "privacy", href: `${ANGULAR_APP_URL}/legal/confidentialite` },
  { id: "changelog", href: "/changelog", internal: true },
  { id: "support", href: "/support", internal: true },
  { id: "contact", href: `mailto:${CONTACT_EMAIL}` },
] as const satisfies readonly {
  id: keyof Dictionary["footer"]["links"];
  href: string;
  external?: boolean;
  internal?: boolean;
}[];

export function Footer({ dict }: { dict: Dictionary["footer"] }) {
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
            <p className="mt-2 text-sm font-medium text-text">{dict.tagline}</p>
          </div>

          <nav
            aria-label={dict.navAriaLabel}
            className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-text"
          >
            {FOOTER_LINKS.map((link) => {
              const label = dict.links[link.id];
              const className =
                "inline-flex min-h-11 min-w-11 items-center rounded-md transition-colors duration-200 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none lg:items-end";

              if ("internal" in link && link.internal) {
                return (
                  <Link key={link.id} href={link.href} className={className}>
                    {label}
                  </Link>
                );
              }

              return (
                <a
                  key={link.id}
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
                  {label}
                </a>
              );
            })}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
