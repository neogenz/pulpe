// Source unique de vérité des guides : l'index /guides, le sitemap et les
// métadonnées d'article lisent tous ce registre. Publier un guide = une entrée
// ici + une page sous app/guides/<slug>/.
export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** Date ISO yyyy-mm-dd. */
  publishedAt: string;
  /** Date ISO yyyy-mm-dd — alimente dateModified (JSON-LD) et lastmod (sitemap). */
  updatedAt: string;
  readingMinutes: number;
}

export const GUIDES: Guide[] = [];
