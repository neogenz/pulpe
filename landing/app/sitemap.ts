import type { MetadataRoute } from "next";
import { GUIDES } from "@/components/guides/guides";

// Exigé par `output: "export"` : la route est résolue au build.
export const dynamic = "force-static";

const BASE_URL = "https://pulpe.app";

const STATIC_PAGES = [
  "",
  "/changelog",
  "/support",
  "/support/modeles-et-budgets",
  "/guides",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_PAGES.map((path) => ({ url: `${BASE_URL}${path}` })),
    ...GUIDES.map((guide) => ({
      url: `${BASE_URL}/guides/${guide.slug}`,
      lastModified: guide.updatedAt,
    })),
  ];
}
