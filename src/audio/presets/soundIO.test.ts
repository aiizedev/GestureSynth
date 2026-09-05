import { describe, expect, it } from "vitest";
import { AI_SOUND_PROMPT, parseSound, serializeSound } from "./soundIO";
import { migratePreset, PRESETS } from "./index";

describe("serializeSound", () => {
  it("produce JSON parseable con version 2", () => {
    const text = serializeSound(PRESETS.pad);
    const obj = JSON.parse(text);
    expect(obj.version).toBe(2);
    expect(text).toContain("\n"); // con sangría
  });
});

describe("parseSound", () => {
  it("da la vuelta a serializeSound sin perder nada", () => {
    const round = parseSound(serializeSound(PRESETS.pad));
    expect(round.ok).toBe(true);
    if (round.ok) expect(round.preset).toEqual(migratePreset(PRESETS.pad));
  });

  it("rechaza texto que no es JSON", () => {
    const r = parseSound("{ no json");
    expect(r.ok).toBe(false);
  });

  it("rechaza un JSON que no es objeto", () => {
    expect(parseSound("42").ok).toBe(false);
    expect(parseSound("[1,2,3]").ok).toBe(false);
  });

  it("migra un objeto v1 plano a v2 completo", () => {
    const r = parseSound(
      JSON.stringify({
        waveform: "square",
        envelope: { attack: 0.03, decay: 0.2, sustain: 0.5, release: 0.4 },
        filterCutoff: 1800,
        distortionAmount: 0.1,
        reverbWet: 0.3,
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.preset.version).toBe(2);
      expect(r.preset.oscillator.waveform).toBe("square");
      expect(r.preset.filter.cutoff).toBe(1800);
    }
  });

  it("rellena huecos de un v2 parcial", () => {
    const r = parseSound(
      JSON.stringify({ version: 2, engine: "subtractive", filter: { cutoff: 700 } }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.preset.filter.cutoff).toBe(700);
      expect(r.preset.ampEnv.release).toBeTypeOf("number");
      expect(r.preset.fx.reverb.decay).toBeTypeOf("number");
    }
  });
});

describe("AI_SOUND_PROMPT", () => {
  it("documenta el esquema y los dos motores", () => {
    expect(AI_SOUND_PROMPT).toContain('"version": 2');
    expect(AI_SOUND_PROMPT).toContain("subtractive");
    expect(AI_SOUND_PROMPT).toContain("fm");
    for (const wave of ["sine", "triangle", "sawtooth", "square"]) {
      expect(AI_SOUND_PROMPT).toContain(wave);
    }
  });
});
