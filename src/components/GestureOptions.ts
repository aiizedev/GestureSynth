/**
 * Menú de opciones de `/gesture` — sin `@mediapipe/tasks-vision`, sin `tone`.
 * Botón ⚙ arriba a la derecha que despliega un panel con:
 *  - color principal de la página (se aplica a `--gesture-accent`)
 *  - "información avanzada" → muestra / oculta el HUD de identificación de manos
 * Ambas preferencias se guardan en `localStorage`.
 */
const ACCENT_KEY = "gesturesynth.gesture.accent";
const ADVANCED_KEY = "gesturesynth.gesture.advanced";
const DEFAULT_ACCENT = "#e8a13d";

export interface GestureOptionsCallbacks {
  onAccent: (hex: string) => void;
  onAdvanced: (show: boolean) => void;
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
    const stored = readLS(ACCENT_KEY);
    this.accent = stored && /^#[0-9a-fA-F]{6}$/.test(stored) ? stored : DEFAULT_ACCENT;
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

    const colorRow = document.createElement("label");
    colorRow.className = "options-row";
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = this.accent;
    colorInput.addEventListener("input", () => {
      writeLS(ACCENT_KEY, colorInput.value);
      cb.onAccent(colorInput.value);
    });
    colorRow.append(document.createTextNode("Color principal"), colorInput);

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
