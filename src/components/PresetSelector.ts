/**
 * Selector de preset (timbre) para `/gesture` — sin `@mediapipe/tasks-vision`,
 * sin `tone`. Los `.json` de `audio/presets/` son datos puros; el `Synth` los
 * recibe vía `setTimbre` desde `src/gesture.ts`.
 *
 * Incluye los presets de fábrica (por grupos) y los que el usuario haya guardado
 * en `localStorage` — desde la interfaz de audio (`/`) o importando un sonido
 * desde el menú ⚙ de `/gesture` (que pide nombre y lo guarda como preset de
 * usuario). El dropdown se refresca sin recargar: en la misma pestaña por
 * `USER_PRESETS_EVENT`, entre pestañas por el evento nativo `storage`.
 */
import {
  clonePreset,
  PRESET_GROUPS,
  PRESET_LABELS,
  PRESETS,
  type PresetName,
} from "../audio/presets";
import {
  getUserPreset,
  listUserPresets,
  saveUserPreset,
  STORAGE_KEY as USER_PRESETS_KEY,
  USER_PRESETS_EVENT,
} from "../audio/presets/userStore";
import type { TimbrePreset } from "../audio/presets/types";

const USER_PREFIX = "user:";
const DEFAULT_NAME: PresetName = "pad";

export interface PresetSelectorOptions {
  /** Preset de fábrica inicial. */
  initial?: PresetName;
  onChange: (preset: TimbrePreset) => void;
}

export class PresetSelector {
  readonly element: HTMLDivElement;
  private readonly select: HTMLSelectElement;
  private readonly onChange: (preset: TimbrePreset) => void;
  private _current: TimbrePreset;

  constructor(opts: PresetSelectorOptions) {
    this.onChange = opts.onChange;

    this.element = document.createElement("div");
    this.element.className = "gesture-presets";

    this.select = document.createElement("select");
    this.buildOptions();

    const initial = opts.initial ?? DEFAULT_NAME;
    this.select.value = initial;
    this._current = clonePreset(PRESETS[initial] ?? PRESETS.clean);

    this.select.addEventListener("change", () => {
      const preset = this.resolve(this.select.value);
      if (preset) {
        this._current = preset;
        this.onChange(preset);
      }
    });

    // Presets de usuario guardados sin recargar: misma pestaña (evento propio) o
    // en otra pestaña, p. ej. desde `/` (evento nativo `storage`).
    window.addEventListener(USER_PRESETS_EVENT, this.refresh);
    window.addEventListener("storage", this.onStorage);

    this.element.append(this.select);
  }

  /** Preset seleccionado (para aplicarlo al arrancar el audio). */
  get current(): TimbrePreset {
    return this._current;
  }

  /**
   * Importa un sonido (pegado / subido / de una IA desde el menú ⚙): lo GUARDA
   * como preset de usuario con `name`, lo añade al dropdown bajo "Mis presets"
   * (seleccionado) y lo activa al momento, sin recargar la página.
   */
  applyImported(preset: TimbrePreset, name: string): void {
    saveUserPreset(name, preset); // persiste + dispara USER_PRESETS_EVENT → refresh
    this._current = clonePreset(preset);
    this.buildOptions();
    this.select.value = USER_PREFIX + name;
    this.onChange(this._current);
  }

  /** Quita los listeners de ventana (para tests; en la app vive toda la página). */
  dispose(): void {
    window.removeEventListener(USER_PRESETS_EVENT, this.refresh);
    window.removeEventListener("storage", this.onStorage);
  }

  private readonly refresh = (): void => this.buildOptions();

  private readonly onStorage = (e: StorageEvent): void => {
    if (e.key === null || e.key === USER_PRESETS_KEY) this.buildOptions();
  };

  private resolve(value: string): TimbrePreset | null {
    if (value.startsWith(USER_PREFIX)) {
      return getUserPreset(value.slice(USER_PREFIX.length));
    }
    const factory = PRESETS[value as PresetName];
    return factory ? clonePreset(factory) : null;
  }

  private buildOptions(): void {
    const prev = this.select.value;
    this.select.textContent = "";

    for (const group of PRESET_GROUPS) {
      const og = document.createElement("optgroup");
      og.label = group.label;
      for (const name of group.names) {
        const o = document.createElement("option");
        o.value = name;
        o.textContent = PRESET_LABELS[name] ?? name;
        og.append(o);
      }
      this.select.append(og);
    }

    const users = listUserPresets();
    if (users.length > 0) {
      const og = document.createElement("optgroup");
      og.label = "Mis presets";
      for (const u of users) {
        const o = document.createElement("option");
        o.value = USER_PREFIX + u.name;
        o.textContent = u.name;
        og.append(o);
      }
      this.select.append(og);
    }

    // Conserva la selección si la opción sigue existiendo tras reconstruir.
    if (prev && [...this.select.options].some((o) => o.value === prev)) {
      this.select.value = prev;
    }
  }
}
