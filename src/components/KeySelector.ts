/**
 * Selector de tonalidad para `/gesture` — sin `@mediapipe/tasks-vision`, sin
 * `tone`. Tónica (12 cromáticas) × modo (mayor / menor natural), como en `/`.
 * El modo cambia de qué escala salen las raíces de los grados (Do menor III =
 * Mi♭); la CALIDAD de cada acorde la sigue poniendo la inclinación de la mano.
 * Las etiquetas de la tónica siguen el círculo de quintas (`keyDisplayName`) y
 * se reescriben con bemoles al pasar a menor; el `value` es el nombre con `#`.
 */
import {
  KEY_MODE_LABELS,
  KEY_MODES,
  KEY_NAMES,
  keyDisplayName,
  type KeyMode,
} from "../utils/musicTheory";

export interface KeySelectorState {
  key: string;
  keyMode: KeyMode;
}

export interface KeySelectorOptions {
  key?: string;
  keyMode?: KeyMode;
  onChange: (state: KeySelectorState) => void;
}

export class KeySelector {
  readonly element: HTMLDivElement;
  private key: string;
  private keyMode: KeyMode;

  constructor(opts: KeySelectorOptions) {
    this.key = opts.key ?? "C";
    this.keyMode = opts.keyMode ?? "major";

    this.element = document.createElement("div");
    this.element.className = "gesture-keys";

    const keySel = document.createElement("select");
    keySel.setAttribute("aria-label", "Tónica");
    for (const k of KEY_NAMES) {
      const o = document.createElement("option");
      o.value = k;
      keySel.append(o);
    }
    keySel.value = this.key;

    const modeSel = document.createElement("select");
    modeSel.setAttribute("aria-label", "Modo");
    for (const m of KEY_MODES) {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = KEY_MODE_LABELS[m];
      modeSel.append(o);
    }
    modeSel.value = this.keyMode;

    const relabelKeys = () => {
      for (const o of Array.from(keySel.options)) {
        o.textContent = keyDisplayName(o.value, this.keyMode);
      }
    };
    relabelKeys();

    const emit = () => opts.onChange({ key: this.key, keyMode: this.keyMode });

    keySel.addEventListener("change", () => {
      this.key = keySel.value;
      emit();
    });
    modeSel.addEventListener("change", () => {
      this.keyMode = modeSel.value as KeyMode;
      relabelKeys();
      emit();
    });

    this.element.append(keySel, modeSel);
  }
}
