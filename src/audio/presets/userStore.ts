import type { TimbrePreset } from "./types";
import { migratePreset } from "./index";

/**
 * Presets del usuario, persistidos en `localStorage`. Se guardan con el mismo
 * esquema serializable `TimbrePreset` v2 que los de fábrica, así que un preset
 * guardado se puede copiar tal cual a un `.json` del repo.
 *
 * No importa `tone`: sólo lee/escribe JSON.
 */
const STORAGE_KEY = "gesturesynth.userPresets.v2";

export interface UserPreset {
  name: string;
  preset: TimbrePreset;
}

function read(): UserPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        const e = (entry ?? {}) as { name?: unknown; preset?: unknown };
        return { name: String(e.name ?? "").trim(), preset: migratePreset(e.preset) };
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
  const list = read().filter((e) => e.name !== clean);
  list.push({ name: clean, preset: migratePreset(preset) });
  list.sort((a, b) => a.name.localeCompare(b.name));
  write(list);
  return list;
}

export function deleteUserPreset(name: string): UserPreset[] {
  const list = read().filter((e) => e.name !== name);
  write(list);
  return list;
}
