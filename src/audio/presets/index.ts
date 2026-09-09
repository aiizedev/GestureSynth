import type { ADSR, TimbrePreset } from "./types";
import clean from "./clean.json";
import keys from "./keys.json";
import pad from "./pad.json";
import pluck from "./pluck.json";
import brass from "./brass.json";
import hazypad from "./hazypad.json";
import ballad from "./ballad.json";
import synthpad from "./synthpad.json";
import synthpadthin from "./synthpadthin.json";
import crystalair from "./crystalair.json";
import warmsynth from "./warmsynth.json";
import brightsynth from "./brightsynth.json";
import retrosynth from "./retrosynth.json";
import softpad from "./softpad.json";
import omakase from "./omakase.json";
import overdrive from "./overdrive.json";

export type PresetName =
  | "clean"
  | "keys"
  | "pad"
  | "pluck"
  | "brass"
  | "ballad"
  | "synthpad"
  | "synthpadthin"
  | "crystalair"
  | "hazypad"
  | "warmsynth"
  | "brightsynth"
  | "retrosynth"
  | "softpad"
  | "omakase"
  | "overdrive";

/** Presets agrupados para el `<optgroup>` del dropdown. */
export const PRESET_GROUPS: Array<{ label: string; names: PresetName[] }> = [
  {
    label: "Basic",
    names: ["clean", "keys", "pad", "pluck", "brass"],
  },
  {
    // Pads oscuros y atmosféricos inspirados en Joji (Ballads 1 / Nectar):
    // saws detuneados, reverbs enormes, el acorde de fondo.
    label: "Dark Synths",
    names: ["ballad", "synthpad", "synthpadthin", "crystalair", "hazypad"],
  },
  {
    // Recreación del synth de referencia de Eric Wei
    // (github.com/ericwei97-cloud/gesture-synth) — la idea original de tocar
    // acordes con las manos por cámara: un oscilador → pasa-bajos estático
    // 1200 Hz / Q 0.7, sin FX. El preset es la forma de onda.
    label: "Inspiration — Eric Wei",
    names: ["warmsynth", "brightsynth", "retrosynth"],
  },
  {
    // Pads del usuario.
    label: "Pads",
    names: ["softpad", "omakase", "overdrive"],
  },
];

export const PRESET_NAMES: PresetName[] = PRESET_GROUPS.flatMap((g) => g.names);

/** Nombre visible en el dropdown. */
export const PRESET_LABELS: Record<PresetName, string> = {
  clean: "Clean",
  keys: "Keys",
  pad: "Warm Pad",
  pluck: "Pluck",
  brass: "Brass",
  ballad: "Ballad Lead",
  synthpad: "Midnight Pad",
  synthpadthin: "Midnight Pad Thin",
  crystalair: "Crystal Air",
  hazypad: "Hazy Pad",
  warmsynth: "Warm Synth",
  brightsynth: "Bright Synth",
  retrosynth: "Retro Synth",
  softpad: "SynthPad",
  omakase: "OMAKASE",
  overdrive: "Overdrive",
};

export const PRESETS: Record<PresetName, TimbrePreset> = {
  clean: clean as TimbrePreset,
  keys: keys as TimbrePreset,
  pad: pad as TimbrePreset,
  pluck: pluck as TimbrePreset,
  brass: brass as TimbrePreset,
  ballad: ballad as TimbrePreset,
  synthpad: synthpad as TimbrePreset,
  synthpadthin: synthpadthin as TimbrePreset,
  crystalair: crystalair as TimbrePreset,
  hazypad: hazypad as TimbrePreset,
  warmsynth: warmsynth as TimbrePreset,
  brightsynth: brightsynth as TimbrePreset,
  retrosynth: retrosynth as TimbrePreset,
  softpad: softpad as TimbrePreset,
  omakase: omakase as TimbrePreset,
  overdrive: overdrive as TimbrePreset,
};

/** Preset base — rellena huecos al migrar y es el punto de partida seguro. */
export const DEFAULT_PRESET: TimbrePreset = {
  version: 2,
  engine: "subtractive",
  oscillator: { waveform: "sawtooth", unison: 1, spread: 14 },
  filter: { cutoff: 2000, resonance: 1.5, rolloff: -24, envAmount: 2.0 },
  filterEnv: { attack: 0.01, decay: 0.4, sustain: 0.4, release: 0.4 },
  ampEnv: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.5 },
  drive: 0,
  fx: {
    chorus: 0.1,
    delay: { wet: 0.1, time: "8n", feedback: 0.2 },
    reverb: { wet: 0.2, decay: 2.4 },
  },
  glide: 0,
  master: -6,
};

function adsr(raw: unknown, fallback: ADSR): ADSR {
  const o = (raw ?? {}) as Partial<ADSR>;
  return {
    attack: Number(o.attack ?? fallback.attack),
    decay: Number(o.decay ?? fallback.decay),
    sustain: Number(o.sustain ?? fallback.sustain),
    release: Number(o.release ?? fallback.release),
  };
}

/**
 * Copia profunda de un preset — para no mutar el objeto importado al editar en
 * vivo. `structuredClone` cubre bien la estructura anidada.
 */
export function clonePreset(preset: TimbrePreset): TimbrePreset {
  return structuredClone(preset);
}

/**
 * Normaliza cualquier objeto a un `TimbrePreset` v2 completo. Acepta:
 * - v2: se clona y se completan huecos.
 * - v1 (plano: `waveform`, `envelope`, `filterCutoff`, `distortionAmount`,
 *   `reverbWet`): se remapea a la estructura nueva.
 */
export function migratePreset(raw: unknown): TimbrePreset {
  const d = DEFAULT_PRESET;
  const src = (raw ?? {}) as Record<string, unknown>;

  if (src.version === 2) {
    const p = src as unknown as TimbrePreset;
    return {
      version: 2,
      engine: p.engine === "fm" ? "fm" : "subtractive",
      oscillator: {
        waveform: p.oscillator?.waveform ?? d.oscillator.waveform,
        unison: Number(p.oscillator?.unison ?? d.oscillator.unison),
        spread: Number(p.oscillator?.spread ?? d.oscillator.spread),
      },
      fm: p.fm
        ? {
            harmonicity: Number(p.fm.harmonicity ?? 2),
            modulationIndex: Number(p.fm.modulationIndex ?? 6),
            modWaveform: p.fm.modWaveform ?? "sine",
          }
        : undefined,
      filter: {
        cutoff: Number(p.filter?.cutoff ?? d.filter.cutoff),
        resonance: Number(p.filter?.resonance ?? d.filter.resonance),
        rolloff: p.filter?.rolloff ?? d.filter.rolloff,
        envAmount: Number(p.filter?.envAmount ?? d.filter.envAmount),
      },
      filterEnv: adsr(p.filterEnv, d.filterEnv),
      ampEnv: adsr(p.ampEnv, d.ampEnv),
      drive: Number(p.drive ?? d.drive),
      fx: {
        chorus: Number(p.fx?.chorus ?? d.fx.chorus),
        delay: {
          wet: Number(p.fx?.delay?.wet ?? d.fx.delay.wet),
          time: p.fx?.delay?.time ?? d.fx.delay.time,
          feedback: Number(p.fx?.delay?.feedback ?? d.fx.delay.feedback),
        },
        reverb: {
          wet: Number(p.fx?.reverb?.wet ?? d.fx.reverb.wet),
          decay: Number(p.fx?.reverb?.decay ?? d.fx.reverb.decay),
        },
      },
      glide: Number(p.glide ?? d.glide),
      master: Number(p.master ?? d.master),
    };
  }

  // --- v1 plano ---------------------------------------------------------------
  const env = (src.envelope ?? {}) as Partial<ADSR>;
  return {
    ...structuredClone(d),
    oscillator: {
      waveform: (src.waveform as TimbrePreset["oscillator"]["waveform"]) ??
        d.oscillator.waveform,
      unison: 0,
      spread: 0,
    },
    filter: { ...d.filter, cutoff: Number(src.filterCutoff ?? d.filter.cutoff) },
    ampEnv: adsr(env, d.ampEnv),
    drive: Number(src.distortionAmount ?? 0),
    fx: {
      ...structuredClone(d.fx),
      reverb: {
        wet: Number(src.reverbWet ?? d.fx.reverb.wet),
        decay: d.fx.reverb.decay,
      },
    },
  };
}
