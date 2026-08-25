import Negotiator from "negotiator";
import { type NextRequest, NextResponse } from "next/server";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/routes";

const HTML = "text/html";
const MARKDOWN = "text/markdown";
const VARY = "Accept, Accept-Encoding";
const PUBLIC_PATHS = new Set(
  sitemap().map(({ url }) => new URL(url).pathname.replace(/\/$/, "") || "/"),
);
const NOT_FOUND_MARKDOWN = `# Page introuvable

Le chemin demandé n’existe pas sur pulpe.app.

- [Accueil](${SITE_URL})
- [Plan du site](${SITE_URL}/sitemap.xml)
- [Instructions pour les agents](${SITE_URL}/llms.txt)
- [Aide et contact](${SITE_URL}/support)
- [Application Pulpe](https://app.pulpe.app)
`;

function negotiator(request: NextRequest) {
  return new Negotiator({
    headers: { accept: request.headers.get("accept") ?? undefined },
  });
}

function withVary(response: NextResponse) {
  response.headers.set("Vary", VARY);
  return response;
}

export default function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  const accepted = negotiator(request);

  if (!PUBLIC_PATHS.has(path)) {
    const preferred = accepted.mediaType([HTML, MARKDOWN]);

    if (preferred === MARKDOWN) {
      return withVary(
        new NextResponse(
          request.method === "HEAD" ? null : NOT_FOUND_MARKDOWN,
          {
            status: 404,
            headers: { "Content-Type": `${MARKDOWN}; charset=utf-8` },
          },
        ),
      );
    }

    if (preferred !== HTML) {
      return withVary(new NextResponse(null, { status: 406 }));
    }

    return withVary(NextResponse.next());
  }

  if (path === "/") {
    const preferred = accepted.mediaType([HTML, MARKDOWN]);

    if (preferred === MARKDOWN) {
      const response = NextResponse.rewrite(new URL("/index.md", request.url));
      response.headers.set("Content-Type", `${MARKDOWN}; charset=utf-8`);
      return withVary(response);
    }

    if (preferred !== HTML) {
      return withVary(new NextResponse(null, { status: 406 }));
    }
  } else if (!accepted.mediaType([HTML])) {
    return withVary(new NextResponse(null, { status: 406 }));
  }

  return withVary(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next|app(?:/|$)|ph(?:/|$)|.*\\.[^/]+$).*)"],
};
