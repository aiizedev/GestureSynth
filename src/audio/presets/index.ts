import type { ADSR, TimbrePreset } from "./types";
import clean from "./clean.json";
import keys from "./keys.json";
import pad from "./pad.json";
import pluck from "./pluck.json";
import brass from "./brass.json";
import gritty from "./gritty.json";
import epiano from "./epiano.json";
import bells from "./bells.json";
import hazypad from "./hazypad.json";
import ballad from "./ballad.json";
import rhodes from "./rhodes.json";
import coldbells from "./coldbells.json";
import feltkeys from "./feltkeys.json";
import darkwash from "./darkwash.json";

export type PresetName =
  | "clean"
  | "keys"
  | "pad"
  | "pluck"
  | "brass"
  | "gritty"
  | "epiano"
  | "bells"
  | "hazypad"
  | "ballad"
  | "rhodes"
  | "coldbells"
  | "feltkeys"
  | "darkwash";

/** Presets agrupados para el `<optgroup>` del dropdown. */
export const PRESET_GROUPS: Array<{ label: string; names: PresetName[] }> = [
  {
    label: "Basic",
    names: ["clean", "keys", "pad", "pluck", "brass", "gritty", "epiano", "bells"],
  },
  {
    // Inspirados en Joji (Ballads 1 / Nectar / Smithereens): pads detuneados,
    // Rhodes filtrado, campanas FM frías, reverbs enormes.
    label: "Joji / ballad",
    names: ["ballad", "hazypad", "rhodes", "coldbells", "feltkeys", "darkwash"],
  },
];

export const PRESET_NAMES: PresetName[] = PRESET_GROUPS.flatMap((g) => g.names);

/** Nombre visible en el dropdown (el público no ve "epiano"). */
export const PRESET_LABELS: Record<PresetName, string> = {
  clean: "Clean",
  keys: "Keys",
  pad: "Warm Pad",
  pluck: "Pluck",
  brass: "Brass",
  gritty: "Gritty",
  epiano: "E-Piano",
  bells: "Bells",
  ballad: "Ballad Lead",
  hazypad: "Hazy Pad",
  rhodes: "Mellow Rhodes",
  coldbells: "Cold Bells",
  feltkeys: "Felt Keys",
  darkwash: "Dark Wash",
};

export const PRESETS: Record<PresetName, TimbrePreset> = {
  clean: clean as TimbrePreset,
  keys: keys as TimbrePreset,
  pad: pad as TimbrePreset,
  pluck: pluck as TimbrePreset,
  brass: brass as TimbrePreset,
  gritty: gritty as TimbrePreset,
  epiano: epiano as TimbrePreset,
  bells: bells as TimbrePreset,
  hazypad: hazypad as TimbrePreset,
  ballad: ballad as TimbrePreset,
  rhodes: rhodes as TimbrePreset,
  coldbells: coldbells as TimbrePreset,
  feltkeys: feltkeys as TimbrePreset,
  darkwash: darkwash as TimbrePreset,
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
