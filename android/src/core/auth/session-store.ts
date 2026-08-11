import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";

import { queryClient } from "@/core/query/query-client";

import { signOutThisDevice, supabase } from "./supabase";

/**
 * `locked` — the vault state — deliberately does not exist yet. Nothing sets
 * it and nothing reads it before the encryption work of phase 3, and an
 * unreachable state reads as reachable to whoever branches on it next.
 */
export type SessionStatus = "loading" | "unauthenticated" | "authenticated";

interface SessionState {
  status: SessionStatus;
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
}

function applySession(session: Session | null): Partial<SessionState> {
  return {
    status: session ? "authenticated" : "unauthenticated",
    session,
    user: session?.user ?? null,
  };
}

export const useSessionStore = create<SessionState>((set) => ({
  status: "loading",
  session: null,
  user: null,

  signOut: async () => {
    await signOutThisDevice();
    // Cached budget data belongs to the account that just left the device.
    queryClient.clear();
    set(applySession(null));
  },
}));

/**
 * Restores the persisted session, then keeps the store in step with
 * supabase-js. Token refreshes and expiry both arrive through this listener,
 * so the store never has to poll.
 */
export function observeSession(): () => void {
  void supabase.auth
    .getSession()
    .then(({ data }) => useSessionStore.setState(applySession(data.session)));

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") queryClient.clear();
    useSessionStore.setState(applySession(session));
  });

  return () => data.subscription.unsubscribe();
}
