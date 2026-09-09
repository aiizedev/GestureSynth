/**
 * Acceso a la tabla `public.presets` de Supabase. Importa solo `./supabaseClient`
 * (regla de aislamiento: `@supabase/supabase-js` vive en un único módulo).
 *
 * Todas las funciones son no-op / devuelven vacío si no hay cliente configurado
 * o no hay sesión iniciada. Nadie llama a esto directamente: lo conecta
 * `presetSync.ts` según el estado de la sesión.
 */
import { supabase } from "./supabaseClient";
import type { TimbrePreset } from "../audio/presets/types";

export interface RemotePreset {
  name: string;
  /** JSON tal cual llega de la fila; se pasa por `migratePreset` al fusionar. */
  preset: TimbrePreset;
  /** `updated_at` del servidor en ms epoch. */
  updatedAt: number;
}

async function userId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Todos los presets del usuario en la nube. `[]` si no hay cliente/sesión o error. */
export async function listRemote(): Promise<RemotePreset[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("presets")
    .select("name, preset, updated_at");
  if (error || !data) return [];
  return data.map((row) => ({
    name: String(row.name),
    preset: row.preset as TimbrePreset,
    updatedAt: Date.parse(String(row.updated_at)) || 0,
  }));
}

/** Crea o actualiza un preset. `updated_at` lo pone el servidor. */
export async function upsertRemote(
  name: string,
  preset: TimbrePreset,
): Promise<void> {
  if (!supabase) return;
  const uid = await userId();
  if (!uid) return;
  await supabase
    .from("presets")
    .upsert({ user_id: uid, name, preset }, { onConflict: "user_id,name" });
}

export async function deleteRemote(name: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("presets").delete().eq("name", name);
}

/**
 * Realtime: llama a `cb` cuando cambian mis presets en la nube (otra pestaña o
 * dispositivo). Best-effort: si Realtime no conecta, no pasa nada. Devuelve la
 * función para desuscribir.
 */
export function subscribeRemote(cb: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("presets-sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "presets" },
      () => cb(),
    )
    .subscribe();
  return () => {
    void supabase?.removeChannel(channel);
  };
}
