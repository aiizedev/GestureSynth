// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// El `Synth` real, pero con un `tone` simulado que modela el pool de voces del
// PolySynth, `maxPolyphony` y la cola de release con un reloj virtual.
vi.mock("tone", () => import("./fakeTone"));

import { audioSim } from "./fakeTone";
import { Synth } from "./Synth";
import { PanelPerformanceSource } from "../tracking/PanelPerformanceSource";
import { makeGestureApplier } from "../utils/gestureMapping";
import { PRESETS, type PresetName } from "./presets";
import { buildChord } from "../utils/musicTheory";
import type { ChordIntent } from "../utils/gestureMapping";

interface Step {
  degree: number;
  quality: ChordIntent["quality"];
}

/** Bucle diatónico en Do mayor, 16 pasos, que VUELVE a I / vi / IV / V. */
const LOOP_16: Step[] = Array.from({ length: 4 }, () => [
  { degree: 1, quality: "major" as const },
  { degree: 6, quality: "minor" as const },
  { degree: 4, quality: "major" as const },
  { degree: 5, quality: "major" as const },
]).flat();

/** Spam largo (24) para exigir el tope de acordes resonando. */
const LOOP_24: Step[] = Array.from({ length: 24 }, (_, i) => {
  const q: Step[] = [
    { degree: 1, quality: "major" },
    { degree: 2, quality: "minor" },
    { degree: 3, quality: "minor" },
    { degree: 4, quality: "major" },
    { degree: 5, quality: "major" },
    { degree: 6, quality: "minor" },
  ];
  return q[i % q.length];
});

const VOICING = 3; // séptima → 4 notas por acorde, más presión de polifonía

function expectedNotes(step: Step): string[] {
  return buildChord({
    key: "C",
    keyMode: "major",
    degree: step.degree,
    quality: step.quality,
    voicing: VOICING,
    octave: 0,
  }).map(String);
}

interface RunResult {
  /** Pasos en los que faltó alguna nota SOSTENIDA en el momento de muestreo. */
  incomplete: Array<{ step: number; degree: number; missing: string[] }>;
  /** Notas que el PolySynth descartó por falta de voces. */
  drops: Array<{ note: string; at: number }>;
  peakVoices: number;
}

/**
 * Toca la progresión a 1 s por acorde y comprueba, 900 ms después de cada
 * cambio (con el pad AÚN pulsado), que todas las notas del acorde están
 * sonando en ataque.
 */
async function playProgression(
  presetName: PresetName,
  steps: Step[],
  mode: "tap" | "legato",
): Promise<RunResult> {
  audioSim.reset();
  const synth = new Synth();
  synth.setTimbre(PRESETS[presetName]);
  await synth.start();

  const source = new PanelPerformanceSource();
  source.subscribe(makeGestureApplier(synth));
  source.setChordConfig({ voicing: VOICING });

  const incomplete: RunResult["incomplete"] = [];
  let peakVoices = 0;

  steps.forEach((step, i) => {
    if (mode === "legato") {
      if (i === 0) source.pressPad(step.degree, step.quality);
      else source.setChordConfig({ degree: step.degree, quality: step.quality });
    } else {
      source.pressPad(step.degree, step.quality);
    }

    audioSim.advance(900);
    peakVoices = Math.max(peakVoices, audioSim.voices.length);

    const held = audioSim.held();
    const missing = expectedNotes(step).filter((f) => !held.has(f));
    if (missing.length) {
      incomplete.push({ step: i + 1, degree: step.degree, missing });
    }

    if (mode === "tap") source.releasePad();
    audioSim.advance(100); // total 1000 ms por acorde
  });

  return { incomplete, drops: audioSim.drops.slice(), peakVoices };
}

const PRESETS_UNDER_TEST: PresetName[] = [
  "keys", // release corto (~1.1 s)
  "pad", // medio (~2.6 s)
  "synthpad", // largo (~6 s)
  "crystalair", // muy largo (~7 s)
];

beforeEach(() => {
  audioSim.reset();
});

describe("Synth — sucesión rápida de acordes (1 s por acorde)", () => {
  for (const preset of PRESETS_UNDER_TEST) {
    it(`[${preset}] bucle de 16 con pads (tap): ningún acorde suena incompleto`, async () => {
      const r = await playProgression(preset, LOOP_16, "tap");
      expect(r.drops).toEqual([]);
      expect(r.incomplete).toEqual([]);
    });

    it(`[${preset}] bucle de 16 legato (mantener y cambiar de grado): ningún acorde incompleto`, async () => {
      const r = await playProgression(preset, LOOP_16, "legato");
      expect(r.drops).toEqual([]);
      expect(r.incomplete).toEqual([]);
    });
  }

  it("[crystalair] spam de 24 acordes con release muy largo: no agota las voces ni pierde notas", async () => {
    const r = await playProgression("crystalair", LOOP_24, "tap");
    expect(r.drops).toEqual([]);
    expect(r.incomplete).toEqual([]);
    expect(r.peakVoices).toBeLessThanOrEqual(48);
  });
});
