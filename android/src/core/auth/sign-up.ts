import type { AuthError } from "@supabase/supabase-js";

import { supabase } from "./supabase";

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_UNPROCESSABLE = 422;

/**
 * Creates the account the onboarding flow needs before it can save anything.
 *
 * Supabase answers in English and names its own internals, so nothing from
 * `error.message` reaches the screen — the one case worth telling apart is an
 * address that already has an account, which is a wrong turn rather than a
 * failure.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<void> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(signUpFailureMessage(error));

  // An existing address comes back as a success with an empty identity list
  // rather than an error, so that case has to be read off the payload.
  if (data.user !== null && data.user.identities?.length === 0) {
    throw new Error(
      "Un compte existe déjà avec cette adresse. Connecte-toi plutôt.",
    );
  }
}

function signUpFailureMessage(error: AuthError): string {
  if (error.status === HTTP_TOO_MANY_REQUESTS) {
    return "Trop de tentatives — patiente un moment.";
  }
  if (error.status === undefined) {
    return "Connexion impossible — vérifie ta connexion internet.";
  }
  if (error.status === HTTP_UNPROCESSABLE) {
    return "Cette adresse ou ce mot de passe n'est pas accepté.";
  }
  return "Création du compte impossible — réessaie.";
}
