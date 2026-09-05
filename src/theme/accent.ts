/**
 * Color de acento de la interfaz, compartido por las dos páginas. Es la paleta
 * pastel que `/gesture` ya ofrecía en su menú ⚙ ("Color principal"); ahora `/`
 * también deja elegirlo (`ThemePicker`). Se guarda en `localStorage` con la
 * misma clave, así que la elección viaja entre `/` y `/gesture`.
 *
 * Sin `tone`, sin DOM salvo `applyAccent` (que sólo escribe una variable CSS).
 */
export interface AccentSwatch {
  hex: string;
  name: string;
}

/** Paleta pastel (mezcla cálida + fría), la misma de `/gesture`. */
export const ACCENT_SWATCHES: readonly AccentSwatch[] = [
  { hex: "#f3c69b", name: "albaricoque" },
  { hex: "#ecdca0", name: "mantequilla" },
  { hex: "#f0b3c1", name: "rosa" },
  { hex: "#a8e0c8", name: "menta" },
  { hex: "#a8c8f0", name: "cielo" },
  { hex: "#c9b8f0", name: "lavanda" },
] as const;

export const DEFAULT_ACCENT = ACCENT_SWATCHES[0].hex;

export const ACCENT_KEY = "gesturesynth.gesture.accent";

const HEX = /^#[0-9a-fA-F]{6}$/;

export function readAccent(): string {
  try {
    const raw = localStorage.getItem(ACCENT_KEY);
    return raw && HEX.test(raw) ? raw : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function writeAccent(hex: string): void {
  try {
    localStorage.setItem(ACCENT_KEY, hex);
  } catch {
    /* modo privado / storage bloqueado: se ignora */
  }
}

/** Vuelca el acento a `--accent` en `:root` para que toda la CSS lo herede. */
export function applyAccent(hex: string): void {
  document.documentElement.style.setProperty("--accent", hex);
}

/**
 * Se dispara cuando OTRA pestaña / ventana del mismo origen cambia el acento
 * (evento nativo `storage`; NO se auto-emite en la pestaña que lo escribió). Así
 * `/` y `/gesture` abiertos a la vez cambian de color juntos. Devuelve la
 * función para desuscribir.
 */
export function onAccentChange(cb: (hex: string) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.storageArea && e.storageArea !== localStorage) return;
    if (e.key !== null && e.key !== ACCENT_KEY) return;
    cb(readAccent());
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
