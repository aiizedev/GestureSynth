import type { ChordIntent } from "./gestureMapping";

/**
 * Teoría musical aislada: tonalidad + grado + calidad + voicing + octava → notas.
 *
 * Portado de las tablas del repo de referencia `ericwei97-cloud/gesture-synth`.
 * No conoce Tone.js ni nada de audio: sólo devuelve frecuencias / nombres.
 */

const CHROMATIC = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

/** Semitonos de cada grado de la escala mayor (pasos 2-2-1-2-2-2-1 acumulados). */
const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

/** MIDI de la tónica en su registro base (C3 = 48), cómodo para acompañamiento. */
const TONIC_BASE_MIDI = 48;

/** MIDI de referencia A4 = 69 → 440 Hz. */
const A4_MIDI = 69;
const A4_HZ = 440;

export const KEY_NAMES = [...CHROMATIC];
export const DEGREE_LABELS = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;
export type Voicing = 1 | 2 | 3 | 4 | 5;
export const VOICING_LABELS: Record<Voicing, string> = {
  1: "tríada fundamental (1-3-5)",
  2: "1ª inversión (3-5-8)",
  3: "séptima (maj7 / m7)",
  4: "dominante / dim7",
  5: "aumentada / disminuida (#5 / ♭5)",
};

function keyOffset(key: string): number {
  const idx = CHROMATIC.indexOf(key as (typeof CHROMATIC)[number]);
  return idx < 0 ? 0 : idx;
}

function midiToFreq(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * Intervalos (semitonos desde la raíz) para una combinación calidad + voicing.
 * Tabla equivalente a la del repo de referencia (finger count 1..4) + voicing 5.
 */
export function chordIntervals(
  quality: "major" | "minor",
  voicing: Voicing,
): number[] {
  const third = quality === "major" ? 4 : 3;
  switch (voicing) {
    case 1:
      return [0, third, 7];
    case 2:
      return [third, 7, 12];
    case 3:
      return quality === "major" ? [0, 4, 7, 11] : [0, 3, 7, 10];
    case 4:
      return quality === "major" ? [0, 4, 7, 10] : [0, 3, 6, 9];
    case 5:
      // Tríada alterada sin séptima: aumentada (#5) en mayor, disminuida (♭5)
      // en menor.
      return quality === "major" ? [0, 4, 8] : [0, 3, 6];
  }
}

/** MIDI de la raíz del acorde para el grado / tonalidad / octava pedidos. */
function rootMidi(intent: ChordIntent): number {
  const degreeIndex = Math.min(6, Math.max(0, intent.degree - 1));
  return (
    TONIC_BASE_MIDI +
    keyOffset(intent.key) +
    MAJOR_SCALE_SEMITONES[degreeIndex] +
    12 * intent.octave
  );
}

/** Frecuencias (Hz) del acorde. Es lo que consume `Synth.setChord`. */
export function buildChord(intent: ChordIntent): number[] {
  const base = rootMidi(intent);
  return chordIntervals(intent.quality, intent.voicing).map((semi) =>
    midiToFreq(base + semi),
  );
}

/** Nombre de nota (sin octava) para cada voz del acorde — para el HUD. */
export function chordNoteNames(intent: ChordIntent): string[] {
  const base = rootMidi(intent);
  return chordIntervals(intent.quality, intent.voicing).map(
    (semi) => CHROMATIC[(((base + semi) % 12) + 12) % 12],
  );
}

/** Etiqueta legible del acorde, p. ej. "C  ·  V  ·  maj7". */
export function describeChord(intent: ChordIntent): {
  root: string;
  label: string;
  notes: string[];
} {
  const rootPc = CHROMATIC[(((rootMidi(intent) % 12) + 12) % 12)];
  const qual = intent.quality === "major" ? "" : "m";
  const ext =
    intent.voicing === 3
      ? intent.quality === "major"
        ? "maj7"
        : "7"
      : intent.voicing === 4
        ? intent.quality === "major"
          ? "7"
          : "dim7"
        : intent.voicing === 5
          ? intent.quality === "major"
            ? "(#5)"
            : "(♭5)"
          : intent.voicing === 2
            ? "/inv"
            : "";
  // Grado en números romanos: mayúsculas para acordes mayores, minúsculas para
  // menores. Así se leen de un vistazo dominantes secundarias / préstamos.
  const degLabel = DEGREE_LABELS[Math.min(6, Math.max(0, intent.degree - 1))];
  const roman = intent.quality === "major" ? degLabel : degLabel.toLowerCase();
  return {
    root: rootPc,
    label: `${rootPc}${qual}${ext ? " " + ext : ""}  ·  ${roman}`,
    notes: chordNoteNames(intent),
  };
}
