import { describe, expect, it } from "vitest";
import type { ChordIntent } from "./gestureMapping";
import {
  buildChord,
  chordIntervals,
  chordNoteNames,
  describeChord,
} from "./musicTheory";

const base: ChordIntent = {
  key: "C",
  degree: 1,
  quality: "major",
  voicing: 1,
  octave: 0,
};

describe("chordIntervals", () => {
  it("voicing 1 es tríada en estado fundamental (1-3-5)", () => {
    expect(chordIntervals("major", 1)).toEqual([0, 4, 7]);
    expect(chordIntervals("minor", 1)).toEqual([0, 3, 7]);
  });

  it("voicing 3 es séptima: maj7 en mayor, m7 en menor", () => {
    expect(chordIntervals("major", 3)).toEqual([0, 4, 7, 11]);
    expect(chordIntervals("minor", 3)).toEqual([0, 3, 7, 10]);
  });

  it("voicing 4 es dominante en mayor, dim7 en menor", () => {
    expect(chordIntervals("major", 4)).toEqual([0, 4, 7, 10]);
    expect(chordIntervals("minor", 4)).toEqual([0, 3, 6, 9]);
  });

  it("voicing 5 es tríada alterada sin séptima: aumentada en mayor, disminuida en menor", () => {
    expect(chordIntervals("major", 5)).toEqual([0, 4, 8]);
    expect(chordIntervals("minor", 5)).toEqual([0, 3, 6]);
  });
});

describe("chordNoteNames", () => {
  it("C mayor grado I voicing 1 → C E G", () => {
    expect(chordNoteNames(base)).toEqual(["C", "E", "G"]);
  });

  it("C mayor grado V voicing 3 → G maj7 (G B D F#)", () => {
    expect(
      chordNoteNames({ ...base, degree: 5, voicing: 3 }),
    ).toEqual(["G", "B", "D", "F#"]);
  });

  it("C · grado II menor voicing 4 → dim7 (D F G# B)", () => {
    expect(
      chordNoteNames({ ...base, degree: 2, quality: "minor", voicing: 4 }),
    ).toEqual(["D", "F", "G#", "B"]);
  });

  it("C mayor grado I voicing 5 → C E G# (tríada aumentada)", () => {
    expect(
      chordNoteNames({ ...base, voicing: 5 }),
    ).toEqual(["C", "E", "G#"]);
  });

  it("C menor grado I voicing 5 → C D# F# (tríada disminuida)", () => {
    expect(
      chordNoteNames({ ...base, quality: "minor", voicing: 5 }),
    ).toEqual(["C", "D#", "F#"]);
  });
});

describe("buildChord", () => {
  it("C mayor grado I arranca en C3 ≈ 130.81 Hz", () => {
    expect(buildChord(base)[0]).toBeCloseTo(130.81, 1);
  });

  it("A mayor grado I arranca en A3 = 220 Hz exacto", () => {
    expect(buildChord({ ...base, key: "A" })[0]).toBeCloseTo(220, 5);
  });

  it("la octava +1 duplica la frecuencia", () => {
    const low = buildChord(base)[0];
    const high = buildChord({ ...base, octave: 1 })[0];
    expect(high / low).toBeCloseTo(2, 5);
  });

  it("devuelve tantas voces como intervalos tenga el voicing", () => {
    expect(buildChord({ ...base, voicing: 3 })).toHaveLength(4);
  });
});

describe("describeChord", () => {
  it("etiqueta grado V mayor voicing 3 como G maj7", () => {
    const d = describeChord({ ...base, degree: 5, voicing: 3 });
    expect(d.root).toBe("G");
    expect(d.label).toContain("G maj7");
    expect(d.label).toContain("V");
  });

  it("usa números romanos en minúscula para acordes menores", () => {
    const d = describeChord({ ...base, degree: 2, quality: "minor" });
    expect(d.root).toBe("D");
    expect(d.label).toContain("Dm");
    expect(d.label).toContain("ii");
    expect(d.label).not.toContain("II");
  });

  it("voicing 5 se etiqueta (#5) en mayor y (♭5) en menor, sin séptima", () => {
    const maj = describeChord({ ...base, degree: 3, voicing: 5 });
    expect(maj.root).toBe("E");
    expect(maj.label).toContain("(#5)");
    expect(maj.label).not.toContain("maj7");

    const min = describeChord({ ...base, degree: 2, quality: "minor", voicing: 5 });
    expect(min.label).toContain("(♭5)");
    expect(min.label).toContain("ii");
  });
});

describe("cualquier grado en mayor y en menor (dominantes secundarias / préstamos)", () => {
  it("grado VI mayor en C = A mayor (V/ii), no diatónico", () => {
    expect(
      chordNoteNames({ ...base, degree: 6, quality: "major" }),
    ).toEqual(["A", "C#", "E"]);
  });

  it("grado III mayor en C = E mayor (V/vi), no diatónico", () => {
    expect(
      chordNoteNames({ ...base, degree: 3, quality: "major" }),
    ).toEqual(["E", "G#", "B"]);
  });

  it("grado IV menor en C = F menor (préstamo del modo menor)", () => {
    expect(
      chordNoteNames({ ...base, degree: 4, quality: "minor" }),
    ).toEqual(["F", "G#", "C"]);
  });

  it("misma raíz, distinta calidad: II mayor vs II menor comparten fundamental", () => {
    const maj = buildChord({ ...base, degree: 2, quality: "major" });
    const min = buildChord({ ...base, degree: 2, quality: "minor" });
    expect(min[0]).toBeCloseTo(maj[0], 5);
  });
});
