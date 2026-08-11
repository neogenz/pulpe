import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

import { ENV } from "@/core/config/env";

import { supabase } from "./supabase";

/**
 * Google sign-in, mirroring `GoogleSignInCoordinator` + `AuthService` on iOS:
 * the SDK produces an OIDC ID token, Supabase exchanges it for a session.
 *
 * `webClientId` is the *web* OAuth client, not the Android one — Google issues
 * the ID token with that client as its audience, and Supabase only accepts a
 * token whose audience matches what the dashboard has registered. The Android
 * OAuth client still has to exist (Google matches it by package name and
 * signing certificate), but it is never named here.
 */
export const isGoogleSignInAvailable = ENV.googleWebClientId !== null;

let isConfigured = false;

function configureOnce(webClientId: string): void {
  if (isConfigured) return;
  GoogleSignin.configure({ webClientId });
  isConfigured = true;
}

/**
 * What Google told us about the person, for the one use onboarding has for it:
 * skipping a question it can already answer. `firstName` is null when the
 * provider sent no usable name, and the flow then asks for it.
 */
export interface GoogleSignInResult {
  firstName: string | null;
}

/**
 * `null` means the user backed out — not an error, and nothing to report.
 * Anything genuinely wrong throws with a French message.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult | null> {
  const webClientId = ENV.googleWebClientId;
  if (webClientId === null) {
    throw new Error(
      "La connexion Google n'est pas disponible sur cette build.",
    );
  }

  configureOnce(webClientId);

  const response = await requestGoogleIdToken();
  if (response === null) return null;

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: response,
  });
  if (error) throw new Error(error.message);

  return { firstName: firstNameFromMetadata(data.user?.user_metadata) };
}

/**
 * Google fills `given_name` on most accounts and only `full_name` on some, so
 * both are read; anything else is treated as no name rather than guessed at.
 */
function firstNameFromMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const candidates = [metadata?.given_name, metadata?.full_name];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const firstName = candidate.trim().split(/\s+/)[0];
    if (firstName !== undefined && firstName.length > 0) return firstName;
  }
  return null;
}

async function requestGoogleIdToken(): Promise<string | null> {
  try {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) return null;
    if (response.data.idToken === null) {
      throw new Error("Google n'a pas renvoyé de jeton d'identité.");
    }
    return response.data.idToken;
  } catch (error) {
    if (!isErrorWithCode(error)) throw error;
    // Backing out reaches us as a response on this SDK version, but the older
    // rejection path is still live on some devices, so treat both as a no-op.
    if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw new Error(googleErrorMessage(error.code));
  }
}

function googleErrorMessage(code: string): string {
  if (code === statusCodes.IN_PROGRESS) {
    return "Une connexion Google est déjà en cours.";
  }
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return "Les services Google Play ne sont pas disponibles sur cet appareil.";
  }
  return "Connexion Google impossible — réessaie.";
}
