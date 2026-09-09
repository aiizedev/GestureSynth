import { describe, expect, it } from "vitest";
import {
  clonePreset,
  DEFAULT_PRESET,
  migratePreset,
  PRESET_GROUPS,
  PRESET_LABELS,
  PRESET_NAMES,
  PRESETS,
} from "./index";
import type { TimbrePreset } from "./types";

const DELAY_TIMES = ["8n", "8n.", "4n"];

function isFiniteNum(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v);
}

function assertValid(p: TimbrePreset): void {
  expect(p.version).toBe(2);
  expect(["subtractive", "fm"]).toContain(p.engine);
  for (const env of [p.filterEnv, p.ampEnv]) {
    for (const k of ["attack", "decay", "sustain", "release"] as const) {
      expect(isFiniteNum(env[k])).toBe(true);
    }
  }
  expect(isFiniteNum(p.filter.cutoff)).toBe(true);
  expect([-12, -24, -48]).toContain(p.filter.rolloff);
  expect(DELAY_TIMES).toContain(p.fx.delay.time);
  expect(isFiniteNum(p.fx.reverb.decay)).toBe(true);
  if (p.engine === "fm") {
    expect(p.fm).toBeDefined();
    expect(isFiniteNum(p.fm!.modulationIndex)).toBe(true);
  }
}

describe("presets de fábrica", () => {
  it("todos cumplen el esquema v2", () => {
    for (const name of PRESET_NAMES) assertValid(PRESETS[name]);
  });

  it("todos los presets de fábrica son sustractivos; el motor FM sigue soportado vía migratePreset", () => {
    for (const n of PRESET_NAMES) expect(PRESETS[n].engine).toBe("subtractive");
    const fm = migratePreset({
      version: 2,
      engine: "fm",
      fm: { harmonicity: 3, modulationIndex: 8, modWaveform: "sine" },
    });
    expect(fm.engine).toBe("fm");
    expect(fm.fm).toBeDefined();
  });

  it("los grupos cubren exactamente todos los presets, sin repetidos", () => {
    const grouped = PRESET_GROUPS.flatMap((g) => g.names);
    expect([...grouped].sort()).toEqual([...PRESET_NAMES].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    for (const name of PRESET_NAMES) expect(PRESET_LABELS[name]).toBeTruthy();
    expect(PRESET_GROUPS.map((g) => g.label)).toEqual([
      "Basic",
      "Dark Synths",
      "Inspiration — Eric Wei",
      "Pads",
    ]);
  });

  it("el banco Dark Synths incluye el lead 'Ballad' y los synth pads", () => {
    const bank = PRESET_GROUPS.find((g) => g.label === "Dark Synths")!;
    expect(bank.names).toEqual([
      "ballad",
      "synthpad",
      "synthpadthin",
      "crystalair",
      "hazypad",
    ]);
    assertValid(PRESETS.ballad);
    assertValid(PRESETS.synthpad);
  });

  it("el grupo Pads trae los 3 presets del usuario", () => {
    const bank = PRESET_GROUPS.find((g) => g.label === "Pads")!;
    expect(bank.names).toEqual(["softpad", "omakase", "overdrive"]);
    for (const n of bank.names) assertValid(PRESETS[n]);
    expect(PRESET_LABELS.softpad).toBe("SynthPad");
    expect(PRESET_LABELS.omakase).toBe("OMAKASE");
    expect(PRESET_LABELS.overdrive).toBe("Overdrive");
    expect(PRESETS.overdrive.drive).toBeGreaterThan(0);
  });

  it("el banco 'Inspiration' recrea el synth de referencia: onda + filtro estático 1200 Hz, sin FX", () => {
    const bank = PRESET_GROUPS.find((g) => g.label.includes("Inspiration"))!;
    expect(bank.label).toContain("Eric Wei");
    expect(bank.names).toEqual(["warmsynth", "brightsynth", "retrosynth"]);
    // Warm y Retro se mantienen fieles a la referencia (Bright fue reajustado
    // por el usuario a un pad brillante propio).
    const faithful = [
      ["warmsynth", "triangle"],
      ["retrosynth", "square"],
    ] as const;
    for (const [name, wave] of faithful) {
      const p = PRESETS[name];
      assertValid(p);
      expect(p.engine).toBe("subtractive");
      expect(p.oscillator.waveform).toBe(wave);
      expect(p.oscillator.unison).toBe(0);
      expect(p.filter.cutoff).toBe(1200);
      expect(p.filter.envAmount).toBe(0); // filtro estático, como la referencia
      expect(p.fx.reverb.wet).toBe(0);
      expect(p.fx.delay.wet).toBe(0);
      expect(p.fx.chorus).toBe(0);
    }
    assertValid(PRESETS.brightsynth);
    expect(PRESETS.brightsynth.engine).toBe("subtractive");
    expect(PRESETS.brightsynth.oscillator.waveform).toBe("sawtooth");
  });
});

describe("migratePreset", () => {
  it("convierte un preset v1 plano al esquema v2", () => {
    const v1 = {
      waveform: "sawtooth",
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.6 },
      filterCutoff: 2200,
      distortionAmount: 0.05,
      reverbWet: 0.25,
    };
    const p = migratePreset(v1);
    assertValid(p);
    expect(p.engine).toBe("subtractive");
    expect(p.oscillator.waveform).toBe("sawtooth");
    expect(p.ampEnv.attack).toBe(0.02);
    expect(p.filter.cutoff).toBe(2200);
    expect(p.drive).toBe(0.05);
    expect(p.fx.reverb.wet).toBe(0.25);
  });

  it("pasa un v2 y rellena huecos con DEFAULT_PRESET", () => {
    const partial = { version: 2, engine: "subtractive", filter: { cutoff: 900 } };
    const p = migratePreset(partial);
    assertValid(p);
    expect(p.filter.cutoff).toBe(900);
    expect(p.filter.resonance).toBe(DEFAULT_PRESET.filter.resonance);
    expect(p.ampEnv.release).toBe(DEFAULT_PRESET.ampEnv.release);
  });

  it("es idempotente sobre un preset de fábrica", () => {
    const once = migratePreset(clonePreset(PRESETS.pad));
    const twice = migratePreset(clonePreset(once));
    expect(twice).toEqual(once);
  });
});

describe("clonePreset", () => {
  it("es copia profunda (mutar el clon no toca el original)", () => {
    const clone = clonePreset(PRESETS.keys);
    clone.fx.reverb.wet = 0.99;
    clone.ampEnv.attack = 1.23;
    expect(PRESETS.keys.fx.reverb.wet).not.toBe(0.99);
    expect(PRESETS.keys.ampEnv.attack).not.toBe(1.23);
  });
});
