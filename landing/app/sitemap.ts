import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://pulpe.app";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/legal/cgu`,
      lastModified: new Date("2025-01-01"),
    },
    {
      url: `${baseUrl}/legal/confidentialite`,
      lastModified: new Date("2025-01-01"),
    },
  ];
}
