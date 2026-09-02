/**
 * Selector de tonalidad para `/gesture` — sin `@mediapipe/tasks-vision`, sin
 * `tone`. Solo la **tónica** (12 cromáticas): la calidad de cada acorde la pone
 * la inclinación de la mano, así que un menú mayor/menor sería redundante. Las
 * etiquetas siguen el círculo de quintas (`keyDisplayName`, referencia mayor);
 * el `value` es el nombre con `#` (el id que entiende `musicTheory`).
 */
import { KEY_NAMES, keyDisplayName } from "../utils/musicTheory";

export interface KeySelectorOptions {
  key?: string;
  onChange: (key: string) => void;
}

export class KeySelector {
  readonly element: HTMLDivElement;
  private key: string;

  constructor(opts: KeySelectorOptions) {
    this.key = opts.key ?? "C";

    this.element = document.createElement("div");
    this.element.className = "gesture-keys";

    const sel = document.createElement("select");
    for (const k of KEY_NAMES) {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = keyDisplayName(k, "major");
      sel.append(o);
    }
    sel.value = this.key;
    sel.addEventListener("change", () => {
      this.key = sel.value;
      opts.onChange(this.key);
    });

    this.element.append(sel);
  }
}
