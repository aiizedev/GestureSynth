/**
 * API de autenticación agnóstica de proveedor. No importa `@supabase/supabase-js`
 * directamente: todo pasa por `supabaseClient.ts` (regla de aislamiento).
 *
 * La cuenta solo sirve para guardar los presets en la nube; crear y tocar
 * sonidos no la necesita. Si Supabase no está configurado, todas las funciones
 * son no-ops seguras.
 */
import { supabase, isAuthConfigured } from "./supabaseClient";
import type { Session } from "./supabaseClient";

export { isAuthConfigured };

/** Solo Google en esta fase. Añadir `"github"` aquí es la única línea que hace falta. */
export type AuthProvider = "google";

export interface AccountUser {
  name: string;
  email: string;
  avatarUrl: string | null;
}

/** Lanza el flujo OAuth. Vuelve a la MISMA página (`/` o `/gesture`). */
export async function signIn(provider: AuthProvider = "google"): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Mismo contrato que `theme/accent.ts::onAccentChange`: callback → función para
 * desuscribir. El sync entre pestañas ya lo hace supabase-js internamente, así
 * que aquí NO se añade un listener `storage` propio.
 */
export function onAuthChange(
  cb: (session: Session | null) => void,
): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    cb(session),
  );
  return () => data.subscription.unsubscribe();
}

/**
 * Datos de la cuenta para MOSTRAR (nunca para autorizar). Google mete
 * `name` / `full_name` / `avatar_url` / `picture` / `email` en `user_metadata`.
 */
export function userFromSession(session: Session | null): AccountUser | null {
  const u = session?.user;
  if (!u) return null;
  const m = (u.user_metadata ?? {}) as Record<string, string | undefined>;
  return {
    name: m.name ?? m.full_name ?? m.user_name ?? u.email ?? "cuenta",
    email: u.email ?? m.email ?? "",
    avatarUrl: m.avatar_url ?? m.picture ?? null,
  };
}

export async function currentUser(): Promise<AccountUser | null> {
  return userFromSession(await getSession());
}

/**
 * Limpia `?code=` / `#access_token` / `?error=` de la URL tras el redirect de
 * OAuth. `detectSessionInUrl` ya lo hace; esto es cinturón y tirantes. Llamar
 * una vez al montar la UI de cuenta.
 */
export function cleanupAuthUrl(): void {
  if (/[?#][^#]*\b(code|access_token|error)=/.test(window.location.href)) {
    window.history.replaceState(
      {},
      "",
      window.location.origin + window.location.pathname,
    );
  }
}
