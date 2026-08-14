import type { MetadataRoute } from "next";
import { GUIDES } from "@/components/guides/guides";
import { SITE_URL } from "@/lib/config";

// Exigé par `output: "export"` : la route est résolue au build.
export const dynamic = "force-static";

const STATIC_PAGES = [
  "",
  "/changelog",
  "/support",
  "/support/modeles-et-budgets",
  "/conseils-budget",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_PAGES.map((path) => ({ url: `${SITE_URL}${path}` })),
    ...GUIDES.map((guide) => ({
      url: `${SITE_URL}/conseils-budget/${guide.slug}`,
      lastModified: guide.updatedAt,
    })),
  ];
}
