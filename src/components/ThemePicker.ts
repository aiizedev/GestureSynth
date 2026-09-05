import {
  ACCENT_SWATCHES,
  applyAccent,
  onAccentChange,
  readAccent,
  writeAccent,
} from "../theme/accent";

/**
 * Selector de color de acento para `/` (cabecera). Fila "Tema" + la paleta
 * pastel de `/gesture`. Guarda en `localStorage` (misma clave que `/gesture`) y
 * escribe `--accent` en `:root` al momento, sin recargar. Si otra pestaña
 * cambia el color (p. ej. `/gesture` abierta a la vez), esta se sincroniza vía
 * el evento nativo `storage`. Sin `tone`.
 */
export class ThemePicker {
  readonly element: HTMLDivElement;
  /** Acento activo (ya aplicado a `:root` en el constructor). */
  accent: string;

  private readonly swatches: HTMLButtonElement[] = [];
  private readonly onChange?: (hex: string) => void;
  private readonly stopSync: () => void;

  constructor(onChange?: (hex: string) => void) {
    this.onChange = onChange;
    this.accent = readAccent();
    applyAccent(this.accent);

    this.element = document.createElement("div");
    this.element.className = "theme-picker";

    const label = document.createElement("span");
    label.className = "theme-label";
    label.textContent = "Tema";

    const grid = document.createElement("div");
    grid.className = "swatch-grid";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "Color de acento");

    for (const { hex, name } of ACCENT_SWATCHES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.style.background = hex;
      b.dataset.hex = hex;
      b.setAttribute("aria-label", name);
      b.setAttribute("aria-pressed", String(hex === this.accent));
      b.addEventListener("click", () => {
        writeAccent(hex);
        this.apply(hex);
      });
      this.swatches.push(b);
      grid.append(b);
    }

    this.element.append(label, grid);

    // Otra pestaña cambió el color → seguirla.
    this.stopSync = onAccentChange((hex) => this.apply(hex));
  }

  dispose(): void {
    this.stopSync();
  }

  private apply(hex: string): void {
    this.accent = hex;
    applyAccent(hex);
    for (const s of this.swatches) {
      s.setAttribute("aria-pressed", String(s.dataset.hex === hex));
    }
    this.onChange?.(hex);
  }
}
