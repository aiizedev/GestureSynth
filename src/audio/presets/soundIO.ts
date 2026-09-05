import type { TimbrePreset } from "./types";
import { clonePreset, migratePreset } from "./index";

/**
 * Serialización de sonidos para COMPARTIR: exportar el timbre actual a un JSON
 * de texto y volver a leer uno pegado o subido. El formato es el `TimbrePreset`
 * v2 PURO — el mismo objeto que los `.json` de fábrica de esta carpeta y que
 * devuelve `Synth.getCurrentTimbre()`. Así un sonido exportado se puede pegar
 * tal cual en `src/audio/presets/` como preset de fábrica.
 *
 * No importa `tone`: sólo texto y JSON.
 */

/** Nombre por defecto del archivo al descargar un sonido. */
export const SOUND_FILENAME = "sonido-gesturesynth.json";

/** Timbre actual → JSON con sangría, listo para copiar/descargar. */
export function serializeSound(preset: TimbrePreset): string {
  return JSON.stringify(migratePreset(clonePreset(preset)), null, 2);
}

export type ParseResult =
  | { ok: true; preset: TimbrePreset }
  | { ok: false; error: string };

/**
 * Texto (de un textarea o un archivo) → `TimbrePreset` v2 completo. Tolerante:
 * `migratePreset` acepta v2 parcial y v1 plano y rellena huecos con
 * `DEFAULT_PRESET`. Sólo falla si el texto no es JSON o no es un objeto.
 */
export function parseSound(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "JSON no válido: revisa que hayas pegado el objeto completo." };
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "El JSON debe ser un objeto de sonido." };
  }
  return { ok: true, preset: migratePreset(raw) };
}

/**
 * Prompt listo para pegar en una IA (ChatGPT, Claude…). Describe el esquema
 * campo a campo con sus rangos y un ejemplo válido. La respuesta de la IA se
 * pega en "Importar".
 */
export const AI_SOUND_PROMPT = `Eres diseñador de sonido para un sintetizador web (GestureSynth).
Devuélveme SOLO un objeto JSON (sin markdown, sin \`\`\`, sin explicación) que
describa un sonido con este esquema EXACTO:

{
  "version": 2,
  "engine": "subtractive" | "fm",
      // "subtractive" = analógico (pads, plucks, bajos, leads).
      // "fm" = metálico / campanas / e-pianos.
  "oscillator": {
    "waveform": "sine" | "triangle" | "sawtooth" | "square",
    "unison": 0..3,     // voces extra apiladas (grosor). Sólo subtractive.
    "spread": 0..50     // detune del unison en cents.
  },
  "fm": {               // SÓLO si engine = "fm" (si no, omítelo)
    "harmonicity": 0.25..12,
    "modulationIndex": 0..24,
    "modWaveform": "sine" | "triangle" | "sawtooth" | "square"
  },
  "filter": {
    "cutoff": 100..8000,        // Hz (brillo)
    "resonance": 0..12,
    "rolloff": -12 | -24 | -48, // pendiente dB/oct
    "envAmount": 0..6           // barrido de la envolvente en octavas
  },
  "filterEnv": { "attack": s, "decay": s, "sustain": 0..1, "release": s }, // segundos 0.001..4
  "ampEnv":    { "attack": s, "decay": s, "sustain": 0..1, "release": s }, // segundos 0.001..4
  "drive": 0..1,        // distorsión
  "fx": {
    "chorus": 0..1,
    "delay":  { "wet": 0..1, "time": "8n" | "8n." | "4n", "feedback": 0..0.9 },
    "reverb": { "wet": 0..1, "decay": 0.5..6 }   // decay en segundos
  },
  "glide": 0..0.3,      // portamento en segundos
  "master": -24..0      // volumen de salida en dB
}

Ejemplo de sonido VÁLIDO (un pad cálido):
{
  "version": 2,
  "engine": "subtractive",
  "oscillator": { "waveform": "sawtooth", "unison": 3, "spread": 30 },
  "filter": { "cutoff": 900, "resonance": 3, "rolloff": -24, "envAmount": 2.0 },
  "filterEnv": { "attack": 0.8, "decay": 1.0, "sustain": 0.6, "release": 1.5 },
  "ampEnv": { "attack": 1.1, "decay": 0.6, "sustain": 0.9, "release": 2.6 },
  "drive": 0.02,
  "fx": {
    "chorus": 0.4,
    "delay": { "wet": 0.1, "time": "8n.", "feedback": 0.25 },
    "reverb": { "wet": 0.55, "decay": 3.5 }
  },
  "glide": 0.04,
  "master": -6
}

Quiero un sonido: [descríbelo aquí: p. ej. "campana fría tipo lofi", "bajo con mordida", "pad etéreo y enorme"]`;
