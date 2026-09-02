/**
 * Selector de preset (timbre) para `/gesture` — sin `@mediapipe/tasks-vision`,
 * sin `tone`. Los `.json` de `audio/presets/` son datos puros; el `Synth` los
 * recibe vía `setTimbre` desde `src/gesture.ts`.
 *
 * Incluye los presets de fábrica (por grupos) y los que el usuario haya guardado
 * en `localStorage` desde la interfaz de audio (`/`).
 */
import {
  clonePreset,
  PRESET_GROUPS,
  PRESET_LABELS,
  PRESETS,
  type PresetName,
} from "../audio/presets";
import { getUserPreset, listUserPresets } from "../audio/presets/userStore";
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
  private _current: TimbrePreset;

  constructor(opts: PresetSelectorOptions) {
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
        opts.onChange(preset);
      }
    });

    this.element.append(this.select);
  }

  /** Preset seleccionado (para aplicarlo al arrancar el audio). */
  get current(): TimbrePreset {
    return this._current;
  }

  private resolve(value: string): TimbrePreset | null {
    if (value.startsWith(USER_PREFIX)) {
      return getUserPreset(value.slice(USER_PREFIX.length));
    }
    const factory = PRESETS[value as PresetName];
    return factory ? clonePreset(factory) : null;
  }

  private buildOptions(): void {
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
  }
}
