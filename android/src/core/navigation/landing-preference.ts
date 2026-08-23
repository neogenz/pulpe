import { create } from "zustand";

/**
 * Which of the two signed-out doors the user asked for, or `null` while nobody
 * has asked and the device's own history answers instead.
 *
 * It exists because `/` is a screen rather than a one-shot decision: its
 * `Redirect` is armed on focus, so it re-states `landingRoute` every time the
 * router passes back through it. Crossing from one door to the other was
 * therefore undone on arrival, in whichever direction the history disagreed
 * with — a returning device could reach sign-in and never the pitch, so the
 * only account it could ever offer was the one it already had.
 *
 * Deliberately not persisted: a relaunch is a fresh arrival, and the device's
 * history is the right default again.
 */
interface LandingPreference {
  prefersSignIn: boolean | null;
}

export const useLandingPreference = create<LandingPreference>(() => ({
  prefersSignIn: null,
}));

/** The pitch's "J'ai déjà un compte". */
export function preferSignIn(): void {
  useLandingPreference.setState({ prefersSignIn: true });
}

/** Sign-in's "Créer un compte". */
export function preferPitch(): void {
  useLandingPreference.setState({ prefersSignIn: false });
}

/**
 * Back to the device's history. Signing out makes someone a returning user
 * whatever they asked for on the way in, and a stale answer here would send
 * them to the pitch instead of the form they are coming back to.
 */
export function forgetLandingPreference(): void {
  useLandingPreference.setState({ prefersSignIn: null });
}
