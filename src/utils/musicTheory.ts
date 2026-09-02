import type { ChordIntent } from "./gestureMapping";

/**
 * Teoría musical aislada: tonalidad + grado + calidad + voicing + octava → notas.
 *
 * Portado de las tablas del repo de referencia `ericwei97-cloud/gesture-synth`.
 * No conoce Tone.js ni nada de audio: sólo devuelve frecuencias / nombres.
 */

/**
 * Nomenclatura según el círculo de quintas: las tonalidades del lado sostenido
 * se escriben con `#`, las del lado bemol con `b`. `SHARP_NAMES` es el id estable
 * de cada tónica (lo que guarda `ChordIntent.key`); `keyOffset` acepta ambas
 * grafías.
 */
const SHARP_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;
const FLAT_NAMES = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
] as const;
const CHROMATIC = SHARP_NAMES;

const NOTE_TO_PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

/**
 * Tónicas que se notan con bemoles (lado plano del círculo de quintas), por
 * índice cromático (0 = C). El resto usa sostenidos.
 *   mayores bemoles: F Bb Eb Ab Db   ·   menores bemoles: Dm Gm Cm Fm Bbm Ebm
 */
const FLAT_MAJOR_TONICS = new Set([1, 3, 5, 8, 10]);
const FLAT_MINOR_TONICS = new Set([0, 2, 3, 5, 7, 10]);

/** Tabla de nombres (# o b) que corresponde a la tonalidad tónica+modo. */
function spellingFor(key: string, mode: KeyMode): readonly string[] {
  const idx = keyOffset(key);
  const flats =
    mode === "minor" ? FLAT_MINOR_TONICS.has(idx) : FLAT_MAJOR_TONICS.has(idx);
  return flats ? FLAT_NAMES : SHARP_NAMES;
}

/** Nombre de la tónica tal y como se escribe en esa tonalidad (para la UI). */
export function keyDisplayName(key: string, mode: KeyMode): string {
  return spellingFor(key, mode)[keyOffset(key)];
}

/** Semitonos de cada grado de la escala mayor (pasos 2-2-1-2-2-2-1 acumulados). */
const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

/** Semitonos de cada grado de la escala menor natural (pasos 2-1-2-2-1-2-2). */
const MINOR_SCALE_SEMITONES = [0, 2, 3, 5, 7, 8, 10];

/** MIDI de la tónica en su registro base (C3 = 48), cómodo para acompañamiento. */
const TONIC_BASE_MIDI = 48;

/** MIDI de referencia A4 = 69 → 440 Hz. */
const A4_MIDI = 69;
const A4_HZ = 440;

export const KEY_NAMES = [...CHROMATIC];
export const KEY_MODES = ["major", "minor"] as const;
export type KeyMode = (typeof KEY_MODES)[number];
export const KEY_MODE_LABELS: Record<KeyMode, string> = {
  major: "mayor",
  minor: "menor",
};
export const DEGREE_LABELS = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;
export type Voicing = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const VOICING_LABELS: Record<Voicing, string> = {
  1: "tríada fundamental (1-3-5)",
  2: "inversión 5-1-3 (5ª al bajo)",
  3: "séptima (maj7 / m7)",
  4: "dominante / dim7",
  5: "aumentada / disminuida (#5 / ♭5)",
  6: "séptima invertida 5-1-3-7 (5ª al bajo)",
  7: "dominante / dim7 invertida (5ª al bajo)",
  8: "aumentada / disminuida invertida (5ª al bajo)",
};

function keyOffset(key: string): number {
  return NOTE_TO_PC[key] ?? 0;
}

function midiToFreq(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * Intervalos (semitonos desde la raíz) para una combinación calidad + voicing.
 * Tabla equivalente a la del repo de referencia (finger count 1..4) + voicings
 * 5 (quinta alterada) y 6 (séptima invertida 5-1-3-7).
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
      // Inversión con la 5ª al bajo (una 8ª abajo) → 5-1-3: queda un poco por
      // debajo de la forma fundamental, sin llegar a sonar grave.
      return [-5, 0, third];
    case 3:
      return quality === "major" ? [0, 4, 7, 11] : [0, 3, 7, 10];
    case 4:
      return quality === "major" ? [0, 4, 7, 10] : [0, 3, 6, 9];
    case 5:
      // Tríada alterada sin séptima: aumentada (#5) en mayor, disminuida (♭5)
      // en menor.
      return quality === "major" ? [0, 4, 8] : [0, 3, 6];
    case 6:
      // Séptima invertida 5-1-3-7 con la 5ª al bajo (una 8ª abajo): un poco más
      // grave que la séptima en estado fundamental. maj7 en mayor, m7 en menor.
      return quality === "major" ? [-5, 0, 4, 11] : [-5, 0, 3, 10];
    case 7:
      // Dominante / dim7 invertida: la 5ª del acorde al bajo (una 8ª abajo),
      // luego 1-3-♭7. En menor la 5ª es la disminuida (♭5 = 6 st) → −6.
      return quality === "major" ? [-5, 0, 4, 10] : [-6, 0, 3, 9];
    case 8:
      // Aumentada / disminuida invertida: la 5ª alterada al bajo (una 8ª abajo),
      // luego 1-3. #5 (8 st) → −4 en mayor; ♭5 (6 st) → −6 en menor.
      return quality === "major" ? [-4, 0, 4] : [-6, 0, 3];
  }
}

/** Sufijo del cifrado para el voicing (lo que va tras la raíz y la "m"). */
function chordExt(quality: "major" | "minor", voicing: Voicing): string {
  const maj = quality === "major";
  switch (voicing) {
    case 2:
      return "/inv";
    case 3:
      return maj ? "maj7" : "7";
    case 4:
      return maj ? "7" : "dim7";
    case 5:
      return maj ? "(#5)" : "(♭5)";
    case 6:
      return maj ? "maj7/inv" : "7/inv";
    case 7:
      return maj ? "7/inv" : "dim7/inv";
    case 8:
      return maj ? "(#5)/inv" : "(♭5)/inv";
    default:
      return "";
  }
}

/** MIDI de la raíz del acorde para el grado / tonalidad / octava pedidos. */
function rootMidi(intent: ChordIntent): number {
  const degreeIndex = Math.min(6, Math.max(0, intent.degree - 1));
  // El modo de la tonalidad decide de qué escala salen los grados: en C menor
  // el grado III es E♭ (no E) y el VII es B♭ (no B). La calidad de cada pad es
  // independiente, así siguen valiendo dominantes secundarias y préstamos.
  const scale =
    intent.keyMode === "minor" ? MINOR_SCALE_SEMITONES : MAJOR_SCALE_SEMITONES;
  return (
    TONIC_BASE_MIDI +
    keyOffset(intent.key) +
    scale[degreeIndex] +
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
  const names = spellingFor(intent.key, intent.keyMode);
  return chordIntervals(intent.quality, intent.voicing).map(
    (semi) => names[(((base + semi) % 12) + 12) % 12],
  );
}

/**
 * Descripción legible del acorde.
 *  - `symbol`: cifrado suelto, p. ej. "Cmaj7", "G7", "B°7", "C(#5)".
 *  - `label`: `symbol` + grado en números romanos, p. ej. "Cmaj7  ·  V".
 */
export function describeChord(intent: ChordIntent): {
  root: string;
  symbol: string;
  label: string;
  notes: string[];
} {
  const rootPc =
    spellingFor(intent.key, intent.keyMode)[
      (((rootMidi(intent) % 12) + 12) % 12)
    ];
  const ext = chordExt(intent.quality, intent.voicing);
  // La "m" sobra si la extensión ya dice "dim" (dim7 / dim7/inv): "Ddim7", no
  // "Dmdim7".
  const qual = intent.quality === "major" || ext.includes("dim") ? "" : "m";
  // Grado en números romanos: mayúsculas para acordes mayores, minúsculas para
  // menores. Así se leen de un vistazo dominantes secundarias / préstamos.
  const degLabel = DEGREE_LABELS[Math.min(6, Math.max(0, intent.degree - 1))];
  const roman = intent.quality === "major" ? degLabel : degLabel.toLowerCase();
  const symbol = `${rootPc}${qual}${ext}`;
  return {
    root: rootPc,
    symbol,
    label: `${symbol}  ·  ${roman}`,
    notes: chordNoteNames(intent),
  };
}
