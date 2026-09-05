/**
 * Menú de opciones de `/gesture` — sin `@mediapipe/tasks-vision`, sin `tone`.
 * Botón ⚙ arriba a la derecha que despliega un panel con:
 *  - color principal de la página: paleta pastel (`--gesture-accent`)
 *  - "información avanzada" → muestra / oculta el HUD de identificación de manos
 * Ambas preferencias se guardan en `localStorage`.
 */
import type { TimbrePreset } from "../audio/presets/types";
import {
  ACCENT_KEY,
  ACCENT_SWATCHES,
  onAccentChange,
  readAccent,
} from "../theme/accent";
import { SoundShare } from "./SoundShare";

const ADVANCED_KEY = "gesturesynth.gesture.advanced";

/** Paleta pastel para el color principal de la página. Re-exportada desde el
 *  módulo compartido para no romper importadores/tests existentes. */
export { ACCENT_SWATCHES } from "../theme/accent";

export interface GestureOptionsCallbacks {
  onAccent: (hex: string) => void;
  onAdvanced: (show: boolean) => void;
  /** Sonido actual a exportar. Si falta (junto con `onImport`), no se muestra "Compartir". */
  getSound?: () => TimbrePreset;
  /** Aplicar y guardar un sonido importado con el nombre que puso el usuario. */
  onImport?: (preset: TimbrePreset, name: string) => void;
}

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* modo privado / storage bloqueado: se ignora */
  }
}

export class GestureOptions {
  readonly element: HTMLDivElement;
  /** Valores restaurados de `localStorage`, para que `GestureView` arranque igual. */
  readonly accent: string;
  readonly advanced: boolean;

  private readonly panel: HTMLDivElement;
  private open = false;
  private closeOnOutside?: (ev: MouseEvent) => void;

  constructor(cb: GestureOptionsCallbacks) {
    this.accent = readAccent();
    this.advanced = readLS(ADVANCED_KEY) === "1";

    this.element = document.createElement("div");
    this.element.className = "gesture-options";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gesture-options-btn";
    btn.textContent = "⚙";
    btn.setAttribute("aria-label", "Opciones");

    this.panel = document.createElement("div");
    this.panel.className = "gesture-options-panel";
    this.panel.hidden = true;

    const colorRow = document.createElement("div");
    colorRow.className = "options-row options-row-stack";
    colorRow.append(document.createTextNode("Color principal"));
    const grid = document.createElement("div");
    grid.className = "swatch-grid";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "Color principal");
    const swatches = ACCENT_SWATCHES.map(({ hex, name }) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.style.background = hex;
      b.dataset.hex = hex;
      b.setAttribute("aria-label", name);
      b.setAttribute("aria-pressed", String(hex === this.accent));
      b.addEventListener("click", () => {
        for (const s of swatches) s.setAttribute("aria-pressed", String(s === b));
        writeLS(ACCENT_KEY, hex);
        cb.onAccent(hex);
      });
      return b;
    });
    grid.append(...swatches);
    colorRow.append(grid);

    // Otra pestaña (p. ej. `/` abierta a la vez) cambió el color → seguirla.
    onAccentChange((hex) => {
      for (const s of swatches) {
        s.setAttribute("aria-pressed", String(s.dataset.hex === hex));
      }
      cb.onAccent(hex);
    });

    const advRow = document.createElement("label");
    advRow.className = "options-row";
    const advChk = document.createElement("input");
    advChk.type = "checkbox";
    advChk.checked = this.advanced;
    advChk.addEventListener("change", () => {
      writeLS(ADVANCED_KEY, advChk.checked ? "1" : "0");
      cb.onAdvanced(advChk.checked);
    });
    advRow.append(document.createTextNode("Información avanzada"), advChk);

    this.panel.append(colorRow, advRow);

    if (cb.getSound && cb.onImport) {
      const share = new SoundShare({ getSound: cb.getSound, onImport: cb.onImport });
      const sep = document.createElement("div");
      sep.className = "options-sep";
      this.panel.append(sep, share.element);
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.element.append(btn, this.panel);
  }

  private toggle(): void {
    this.open = !this.open;
    this.panel.hidden = !this.open;

    if (this.open && !this.closeOnOutside) {
      this.closeOnOutside = (ev) => {
        if (!this.element.contains(ev.target as Node)) this.toggle();
      };
      document.addEventListener("click", this.closeOnOutside);
    } else if (!this.open && this.closeOnOutside) {
      document.removeEventListener("click", this.closeOnOutside);
      this.closeOnOutside = undefined;
    }
  }
}
