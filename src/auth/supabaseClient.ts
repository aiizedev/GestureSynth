/**
 * Cliente de Supabase — ÚNICO archivo que importa `@supabase/supabase-js`
 * (regla de aislamiento del repo: una dependencia de terceros vive en un solo
 * módulo, verificable con `grep`). Todo lo demás pasa por aquí.
 *
 * La cuenta es OPCIONAL: si faltan las variables de entorno, `supabase` es
 * `null` e `isAuthConfigured` es `false`. La app entera (crear y tocar sonidos)
 * sigue funcionando sin cuenta; solo se desactiva la UI de sesión.
 */
import { createClient } from "@supabase/supabase-js";

export type { Session, User, SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** `true` solo si están definidas las dos variables `VITE_SUPABASE_*`. */
export const isAuthConfigured: boolean = Boolean(url && key);

export const supabase = isAuthConfigured
  ? createClient(url, key, {
      auth: {
        // PKCE: el token nunca viaja en el fragmento de la URL. `detectSessionInUrl`
        // intercambia el `?code=` automáticamente al cargar la página, así que no
        // hace falta una ruta `/auth/callback` ni `exchangeCodeForSession` manual.
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

if (!isAuthConfigured && import.meta.env.DEV) {
  console.warn(
    "[auth] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY sin definir: la cuenta queda desactivada.",
  );
}
