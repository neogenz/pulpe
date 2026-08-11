import { Redirect } from "expo-router";

import { useSessionStore } from "@/core/auth/session-store";

/**
 * The landing decision has to live on a route that no guard can remove.
 * `Stack.Protected` drops a guarded screen from the navigator rather than
 * redirecting away from it, so if `/` belonged to the protected group, signing
 * out would leave the router pointing at a route that no longer exists — a
 * blank screen, which is exactly what happened.
 */
export default function IndexRoute() {
  const status = useSessionStore((state) => state.status);

  if (status === "loading") return null;
  return <Redirect href={status === "authenticated" ? "/home" : "/sign-in"} />;
}
