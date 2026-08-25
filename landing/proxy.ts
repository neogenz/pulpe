import Negotiator from "negotiator";
import { type NextRequest, NextResponse } from "next/server";
import sitemap from "@/app/sitemap";

const HTML = "text/html";
const MARKDOWN = "text/markdown";
const VARY = "Accept, Accept-Encoding";
const PUBLIC_PATHS = new Set(
  sitemap().map(({ url }) => new URL(url).pathname.replace(/\/$/, "") || "/"),
);

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

  if (!PUBLIC_PATHS.has(path)) return withVary(NextResponse.next());

  const accepted = negotiator(request);

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
