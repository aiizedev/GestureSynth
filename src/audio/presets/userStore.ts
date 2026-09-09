import type { TimbrePreset } from "./types";
import { migratePreset } from "./index";

/**
 * Presets del usuario, persistidos en `localStorage`. Se guardan con el mismo
 * esquema serializable `TimbrePreset` v2 que los de fábrica, así que un preset
 * guardado se puede copiar tal cual a un `.json` del repo.
 *
 * No importa `tone` ni `src/auth/`: sólo lee/escribe JSON. La sincronización con
 * la nube (cuando hay sesión) entra por inversión de control: `setPresetRemote`
 * la enchufa desde `src/auth/presetSync.ts`; sin sesión, `remote` es `null` y
 * todo funciona exactamente igual que antes (solo local).
 */
export const STORAGE_KEY = "gesturesynth.userPresets.v2";

/**
 * Evento de ventana que se emite tras `saveUserPreset` / `deleteUserPreset` /
 * `mergeRemote`. Lo escuchan los selectores de preset (`PresetSelector` en
 * `/gesture`, `TimbrePanel` en `/`) para refrescar su dropdown sin recargar.
 * Entre pestañas distintas ese refresco lo cubre el evento nativo `storage`.
 */
export const USER_PRESETS_EVENT = "gesturesynth:userpresets";

function notifyChange(): void {
  try {
    window.dispatchEvent(new Event(USER_PRESETS_EVENT));
  } catch {
    /* sin `window` (tests node puros): nadie escucha, no pasa nada */
  }
}

export interface UserPreset {
  name: string;
  preset: TimbrePreset;
  /** ms epoch del último guardado local. Falta (esquema viejo) → se lee como 0. */
  updatedAt?: number;
}

// --- Backend remoto opcional (lo enchufa `presetSync.ts` con sesión) ---------

export interface PresetRemote {
  upsert(name: string, preset: TimbrePreset): void;
  remove(name: string): void;
}

let remote: PresetRemote | null = null;

/** `null` = solo local (sin sesión). Un objeto = además se escribe en la nube. */
export function setPresetRemote(r: PresetRemote | null): void {
  remote = r;
}

// --- localStorage -----------------------------------------------------------

function read(): UserPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        const e = (entry ?? {}) as {
          name?: unknown;
          preset?: unknown;
          updatedAt?: unknown;
        };
        return {
          name: String(e.name ?? "").trim(),
          preset: migratePreset(e.preset),
          updatedAt: Number(e.updatedAt) || 0,
        };
      })
      .filter((e) => e.name.length > 0);
  } catch {
    return [];
  }
}

function write(list: UserPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* almacenamiento no disponible o lleno: el preset vive sólo esta sesión */
  }
  notifyChange();
}

export function listUserPresets(): UserPreset[] {
  return read();
}

export function getUserPreset(name: string): TimbrePreset | null {
  const found = read().find((e) => e.name === name);
  return found ? found.preset : null;
}

/** Guarda (o sobrescribe si el nombre ya existe) y devuelve la lista ordenada. */
export function saveUserPreset(name: string, preset: TimbrePreset): UserPreset[] {
  const clean = name.trim();
  if (!clean) return read();
  const migrated = migratePreset(preset);
  const list = read().filter((e) => e.name !== clean);
  list.push({ name: clean, preset: migrated, updatedAt: Date.now() });
  list.sort((a, b) => a.name.localeCompare(b.name));
  write(list);
  remote?.upsert(clean, migrated);
  return list;
}

export function deleteUserPreset(name: string): UserPreset[] {
  const list = read().filter((e) => e.name !== name);
  write(list);
  remote?.remove(name);
  return list;
}

/**
 * Fusiona un snapshot de la nube con la cache local (last-write-wins por
 * `updatedAt`) y persiste el resultado (emite `USER_PRESETS_EVENT`). Devuelve
 * `toPush`: los presets locales que faltan en la nube o que son más nuevos, para
 * que quien llama los suba.
 */
export function mergeRemote(
  entries: { name: string; preset: unknown; updatedAt: number }[],
): { toPush: UserPreset[] } {
  const remoteByName = new Map(entries.map((e) => [e.name, e]));
  const local = read();
  const localByName = new Map(local.map((e) => [e.name, e]));
  const merged: UserPreset[] = [];

  for (const l of local) {
    const r = remoteByName.get(l.name);
    merged.push(
      r && r.updatedAt > (l.updatedAt ?? 0)
        ? { name: l.name, preset: migratePreset(r.preset), updatedAt: r.updatedAt }
        : l,
    );
  }
  for (const r of entries) {
    if (!localByName.has(r.name)) {
      merged.push({
        name: r.name,
        preset: migratePreset(r.preset),
        updatedAt: r.updatedAt,
      });
    }
  }
  merged.sort((a, b) => a.name.localeCompare(b.name));
  write(merged);

  const toPush = merged.filter((e) => {
    const r = remoteByName.get(e.name);
    return !r || (e.updatedAt ?? 0) > r.updatedAt;
  });
  return { toPush };
}
