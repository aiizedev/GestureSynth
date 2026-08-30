import type { Synth } from "../audio/Synth";
import type { Rolloff, TimbrePreset, Waveform } from "../audio/presets/types";
import {
  clonePreset,
  migratePreset,
  PRESET_GROUPS,
  PRESET_LABELS,
  PRESET_NAMES,
  PRESETS,
  type PresetName,
} from "../audio/presets";
import { Knob } from "./Knob";
import { TimbreScope } from "./TimbreScope";

const WAVEFORMS: Array<[Waveform, string]> = [
  ["sine", "Sine"],
  ["triangle", "Tri"],
  ["sawtooth", "Saw"],
  ["square", "Square"],
];

const ROLLOFFS: Array<[Rolloff, string]> = [
  [-12, "12"],
  [-24, "24"],
  [-48, "48"],
];

const CUTOFF_MIN = 200;
const CUTOFF_MAX = 7000;

/**
 * Sección de timbre (columna derecha). La UI está en inglés, la convención de
 * los sintetizadores virtuales. Preset + visualizador + 4 macros
 * ("Brightness / Thickness / Space / Motion") y un bloque "Advanced" plegable
 * con los parámetros sueltos. Todo pasa por `Synth.setTimbre`; este componente
 * NO importa `tone`.
 */
export class TimbrePanel {
  readonly element: HTMLElement;

  private current: TimbrePreset;
  private readonly scope = new TimbreScope();

  private readonly macroKnobs = new Map<string, Knob>();
  private readonly advKnobs = new Map<string, Knob>();

  private readonly waveButtons: HTMLButtonElement[] = [];
  private readonly rolloffButtons: HTMLButtonElement[] = [];
  private oscSubWrap!: HTMLDivElement;
  private oscFmWrap!: HTMLDivElement;
  private filterSection!: HTMLElement;

  constructor(private readonly synth: Synth) {
    this.current = migratePreset(clonePreset(PRESETS[PRESET_NAMES[0]]));

    this.element = document.createElement("section");
    this.element.className = "panel";
    this.element.setAttribute("aria-disabled", "true");

    const h2 = document.createElement("h2");
    h2.textContent = "Timbre";

    this.element.append(
      h2,
      this.buildPresetField(),
      this.scope.element,
      this.buildMacros(),
      this.buildAdvanced(),
    );

    this.loadPreset(PRESET_NAMES[0]);
  }

  setEnabled(enabled: boolean): void {
    this.element.setAttribute("aria-disabled", String(!enabled));
  }

  // --- Preset ------------------------------------------------------------

  private buildPresetField(): HTMLDivElement {
    const field = document.createElement("div");
    field.className = "field";
    const label = document.createElement("label");
    label.textContent = "Preset";
    const select = document.createElement("select");
    for (const group of PRESET_GROUPS) {
      const og = document.createElement("optgroup");
      og.label = group.label;
      for (const name of group.names) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = PRESET_LABELS[name];
        og.append(opt);
      }
      select.append(og);
    }
    select.addEventListener("change", () =>
      this.loadPreset(select.value as PresetName),
    );
    field.append(label, select);
    return field;
  }

  private loadPreset(name: PresetName): void {
    this.current = migratePreset(clonePreset(PRESETS[name]));
    this.refreshEngineUI();
    this.syncMacros();
    this.syncAdvanced();
    this.pushTimbre();
  }

  private pushTimbre(): void {
    this.synth.setTimbre(this.current);
    this.scope.render(this.current);
  }

  // --- Macros ----------------------------------------------------------

  private buildMacros(): HTMLDivElement {
    const wrap = document.createElement("div");
    wrap.className = "macros";

    const add = (
      key: string,
      label: string,
      onInput: (v: number) => void,
    ): void => {
      const knob = new Knob({
        label,
        min: 0,
        max: 100,
        step: 1,
        value: 0,
        default: 50,
        format: (v) => String(Math.round(v)),
        size: "macro",
        onInput: (v) => {
          onInput(v);
          this.syncAdvanced();
          this.pushTimbre();
        },
      });
      this.macroKnobs.set(key, knob);
      wrap.append(knob.element);
    };

    add("brillo", "Brightness", (v) => {
      this.current.filter.cutoff = Math.round(
        CUTOFF_MIN * Math.pow(CUTOFF_MAX / CUTOFF_MIN, v / 100),
      );
    });
    add("grosor", "Thickness", (v) => {
      if (this.current.engine === "fm") {
        this.current.fm = this.ensureFm();
        this.current.fm.modulationIndex = round1(2 + (v / 100) * 14);
      } else {
        this.current.oscillator.unison = Math.round((v / 100) * 3);
        this.current.oscillator.spread = Math.round((v / 100) * 45);
      }
    });
    add("espacio", "Space", (v) => {
      this.current.fx.reverb.wet = round2((v / 100) * 0.7);
      this.current.fx.delay.wet = round2((v / 100) * 0.35);
    });
    add("movimiento", "Motion", (v) => {
      this.current.filter.envAmount = round1((v / 100) * 5);
      this.current.filterEnv.decay = round2(0.15 + (v / 100) * 1.2);
      this.current.filterEnv.sustain = round2(0.5 - (v / 100) * 0.5);
    });

    return wrap;
  }

  private syncMacros(): void {
    const p = this.current;
    const brillo =
      (Math.log(clamp(p.filter.cutoff, CUTOFF_MIN, CUTOFF_MAX) / CUTOFF_MIN) /
        Math.log(CUTOFF_MAX / CUTOFF_MIN)) *
      100;
    const grosor =
      p.engine === "fm"
        ? ((p.fm?.modulationIndex ?? 2) - 2) / 14 * 100
        : (p.oscillator.spread / 45) * 100;
    const espacio = (p.fx.reverb.wet / 0.7) * 100;
    const movimiento = (p.filter.envAmount / 5) * 100;

    this.macroKnobs.get("brillo")!.setValue(clamp(brillo, 0, 100));
    this.macroKnobs.get("grosor")!.setValue(clamp(grosor, 0, 100));
    this.macroKnobs.get("espacio")!.setValue(clamp(espacio, 0, 100));
    this.macroKnobs.get("movimiento")!.setValue(clamp(movimiento, 0, 100));
  }

  // --- Avanzado -------------------------------------------------------

  private buildAdvanced(): HTMLDetailsElement {
    const details = document.createElement("details");
    details.className = "advanced";
    const summary = document.createElement("summary");
    summary.textContent = "Advanced";
    details.append(summary);

    details.append(
      this.buildOscSection(),
      this.buildFilterSection(),
      this.buildAmpEnvSection(),
      this.buildFxSection(),
    );
    return details;
  }

  private section(title: string): HTMLElement {
    const s = document.createElement("div");
    s.className = "timbre-section";
    const h = document.createElement("h3");
    h.textContent = title;
    s.append(h);
    return s;
  }

  private knobRow(section: HTMLElement): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "knob-row";
    section.append(row);
    return row;
  }

  /** Crea un knob "avanzado", lo registra y lo cuelga de `row`. */
  private adv(
    row: HTMLElement,
    key: string,
    label: string,
    o: {
      min: number;
      max: number;
      step: number;
      format: (v: number) => string;
      write: (v: number) => void;
    },
  ): void {
    const knob = new Knob({
      label,
      min: o.min,
      max: o.max,
      step: o.step,
      value: o.min,
      format: o.format,
      onInput: (v) => {
        o.write(v);
        this.syncMacros();
        this.pushTimbre();
      },
    });
    this.advKnobs.set(key, knob);
    row.append(knob.element);
  }

  private buildOscSection(): HTMLElement {
    const s = this.section("Oscillator");

    const waveField = document.createElement("div");
    waveField.className = "field";
    const waveLabel = document.createElement("label");
    waveLabel.textContent = "Wave";
    const waveSeg = document.createElement("div");
    waveSeg.className = "seg";
    for (const [wave, text] of WAVEFORMS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = text;
      btn.addEventListener("click", () => {
        this.current.oscillator.waveform = wave;
        this.refreshWaveButtons();
        this.pushTimbre();
      });
      this.waveButtons.push(btn);
      waveSeg.append(btn);
    }
    waveField.append(waveLabel, waveSeg);
    s.append(waveField);

    // Sub-fila para motor sustractivo (unison / detune)
    this.oscSubWrap = document.createElement("div");
    this.oscSubWrap.className = "knob-row";
    this.adv(this.oscSubWrap, "osc.unison", "Unison", {
      min: 0,
      max: 3,
      step: 1,
      format: (v) => String(Math.round(v)),
      write: (v) => (this.current.oscillator.unison = Math.round(v)),
    });
    this.adv(this.oscSubWrap, "osc.spread", "Detune", {
      min: 0,
      max: 50,
      step: 1,
      format: (v) => `${Math.round(v)} ct`,
      write: (v) => (this.current.oscillator.spread = Math.round(v)),
    });
    s.append(this.oscSubWrap);

    // Sub-fila para motor FM (ratio / índice de modulación)
    this.oscFmWrap = document.createElement("div");
    this.oscFmWrap.className = "knob-row";
    this.adv(this.oscFmWrap, "fm.harmonicity", "Ratio", {
      min: 0.25,
      max: 12,
      step: 0.25,
      format: (v) => v.toFixed(2),
      write: (v) => (this.ensureFm().harmonicity = v),
    });
    this.adv(this.oscFmWrap, "fm.modulationIndex", "FM Amount", {
      min: 0,
      max: 24,
      step: 0.5,
      format: (v) => v.toFixed(1),
      write: (v) => (this.ensureFm().modulationIndex = v),
    });
    s.append(this.oscFmWrap);

    return s;
  }

  private buildFilterSection(): HTMLElement {
    const s = this.section("Filter");
    this.filterSection = s;

    const rollField = document.createElement("div");
    rollField.className = "field";
    const rollLabel = document.createElement("label");
    rollLabel.textContent = "Slope (dB/oct)";
    const rollSeg = document.createElement("div");
    rollSeg.className = "seg";
    for (const [value, text] of ROLLOFFS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = text;
      btn.addEventListener("click", () => {
        this.current.filter.rolloff = value;
        this.refreshRolloffButtons();
        this.pushTimbre();
      });
      this.rolloffButtons.push(btn);
      rollSeg.append(btn);
    }
    rollField.append(rollLabel, rollSeg);
    s.append(rollField);

    const row = this.knobRow(s);
    this.adv(row, "filter.cutoff", "Cutoff", {
      min: 100,
      max: 8000,
      step: 10,
      format: (v) => `${Math.round(v)} Hz`,
      write: (v) => (this.current.filter.cutoff = Math.round(v)),
    });
    this.adv(row, "filter.resonance", "Resonance", {
      min: 0,
      max: 12,
      step: 0.1,
      format: (v) => v.toFixed(1),
      write: (v) => (this.current.filter.resonance = v),
    });
    this.adv(row, "filter.envAmount", "Env Amount", {
      min: 0,
      max: 6,
      step: 0.1,
      format: (v) => `${v.toFixed(1)} oct`,
      write: (v) => (this.current.filter.envAmount = v),
    });

    const envRow = this.knobRow(s);
    this.advAdsr(envRow, "fenv", () => this.current.filterEnv);

    return s;
  }

  private buildAmpEnvSection(): HTMLElement {
    const s = this.section("Envelope");
    const row = this.knobRow(s);
    this.advAdsr(row, "aenv", () => this.current.ampEnv);
    return s;
  }

  private advAdsr(
    row: HTMLElement,
    prefix: string,
    get: () => TimbrePreset["ampEnv"],
  ): void {
    const time = (v: number) => `${v.toFixed(2)} s`;
    this.adv(row, `${prefix}.attack`, "Attack", {
      min: 0.001,
      max: 3,
      step: 0.01,
      format: time,
      write: (v) => (get().attack = v),
    });
    this.adv(row, `${prefix}.decay`, "Decay", {
      min: 0.001,
      max: 3,
      step: 0.01,
      format: time,
      write: (v) => (get().decay = v),
    });
    this.adv(row, `${prefix}.sustain`, "Sustain", {
      min: 0,
      max: 1,
      step: 0.01,
      format: (v) => v.toFixed(2),
      write: (v) => (get().sustain = v),
    });
    this.adv(row, `${prefix}.release`, "Release", {
      min: 0.001,
      max: 4,
      step: 0.01,
      format: time,
      write: (v) => (get().release = v),
    });
  }

  private buildFxSection(): HTMLElement {
    const s = this.section("Effects");
    const row = this.knobRow(s);
    const amt = (v: number) => v.toFixed(2);
    this.adv(row, "fx.drive", "Drive", {
      min: 0,
      max: 1,
      step: 0.01,
      format: amt,
      write: (v) => (this.current.drive = v),
    });
    this.adv(row, "fx.chorus", "Chorus", {
      min: 0,
      max: 1,
      step: 0.01,
      format: amt,
      write: (v) => (this.current.fx.chorus = v),
    });
    this.adv(row, "fx.delayWet", "Delay", {
      min: 0,
      max: 1,
      step: 0.01,
      format: amt,
      write: (v) => (this.current.fx.delay.wet = v),
    });
    this.adv(row, "fx.delayFb", "Feedback", {
      min: 0,
      max: 0.9,
      step: 0.01,
      format: amt,
      write: (v) => (this.current.fx.delay.feedback = v),
    });
    this.adv(row, "fx.reverbWet", "Reverb", {
      min: 0,
      max: 1,
      step: 0.01,
      format: amt,
      write: (v) => (this.current.fx.reverb.wet = v),
    });
    this.adv(row, "glide", "Glide", {
      min: 0,
      max: 0.3,
      step: 0.005,
      format: (v) => `${v.toFixed(2)} s`,
      write: (v) => (this.current.glide = v),
    });
    return s;
  }

  private syncAdvanced(): void {
    const p = this.current;
    const set = (k: string, v: number) => this.advKnobs.get(k)?.setValue(v);
    set("osc.unison", p.oscillator.unison);
    set("osc.spread", p.oscillator.spread);
    set("fm.harmonicity", p.fm?.harmonicity ?? 2);
    set("fm.modulationIndex", p.fm?.modulationIndex ?? 6);
    set("filter.cutoff", p.filter.cutoff);
    set("filter.resonance", p.filter.resonance);
    set("filter.envAmount", p.filter.envAmount);
    set("fenv.attack", p.filterEnv.attack);
    set("fenv.decay", p.filterEnv.decay);
    set("fenv.sustain", p.filterEnv.sustain);
    set("fenv.release", p.filterEnv.release);
    set("aenv.attack", p.ampEnv.attack);
    set("aenv.decay", p.ampEnv.decay);
    set("aenv.sustain", p.ampEnv.sustain);
    set("aenv.release", p.ampEnv.release);
    set("fx.drive", p.drive);
    set("fx.chorus", p.fx.chorus);
    set("fx.delayWet", p.fx.delay.wet);
    set("fx.delayFb", p.fx.delay.feedback);
    set("fx.reverbWet", p.fx.reverb.wet);
    set("glide", p.glide);
  }

  // --- Motor (sustractivo / FM) --------------------------------------

  private ensureFm(): NonNullable<TimbrePreset["fm"]> {
    this.current.fm ??= {
      harmonicity: 2,
      modulationIndex: 6,
      modWaveform: "sine",
    };
    return this.current.fm;
  }

  private refreshEngineUI(): void {
    const fm = this.current.engine === "fm";
    this.oscSubWrap.hidden = fm;
    this.oscFmWrap.hidden = !fm;
    this.filterSection.setAttribute("aria-disabled", String(fm));
    this.refreshWaveButtons();
    this.refreshRolloffButtons();
  }

  private refreshWaveButtons(): void {
    this.waveButtons.forEach((btn, i) =>
      btn.setAttribute(
        "aria-pressed",
        String(WAVEFORMS[i][0] === this.current.oscillator.waveform),
      ),
    );
  }

  private refreshRolloffButtons(): void {
    this.rolloffButtons.forEach((btn, i) =>
      btn.setAttribute(
        "aria-pressed",
        String(ROLLOFFS[i][0] === this.current.filter.rolloff),
      ),
    );
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
