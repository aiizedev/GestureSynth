import { describe, expect, it } from "vitest";
import type { ChordIntent } from "./gestureMapping";
import {
  buildChord,
  chordIntervals,
  chordNoteNames,
  describeChord,
  keyDisplayName,
} from "./musicTheory";

const base: ChordIntent = {
  key: "C",
  keyMode: "major",
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

  it("voicing 6 es la séptima invertida 5-1-3-7 (5ª al bajo, 8ª abajo)", () => {
    expect(chordIntervals("major", 6)).toEqual([-5, 0, 4, 11]);
    expect(chordIntervals("minor", 6)).toEqual([-5, 0, 3, 10]);
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

  it("C mayor grado I voicing 6 → G C E B (maj7 invertida 5-1-3-7)", () => {
    expect(chordNoteNames({ ...base, voicing: 6 })).toEqual(["G", "C", "E", "B"]);
  });

  it("voicing 2 es la inversión 5-1-3 (5ª al bajo), un poco por debajo de la fundamental", () => {
    expect(chordNoteNames({ ...base, voicing: 2 })).toEqual(["G", "C", "E"]);
    const inv = buildChord({ ...base, voicing: 2 });
    const root = buildChord({ ...base, voicing: 1 });
    // El bajo (la 5ª) queda por debajo de la tónica, pero la nota más aguda
    // sigue siendo la 3ª como en la forma fundamental → sólo un poco más grave.
    expect(Math.min(...inv)).toBeLessThan(root[0]);
    expect(Math.max(...inv)).toBeCloseTo(root[1], 5);
  });

  it("C · grado II menor voicing 6 → A D F C (Dm7 invertida 5-1-3-7)", () => {
    expect(
      chordNoteNames({ ...base, degree: 2, quality: "minor", voicing: 6 }),
    ).toEqual(["A", "D", "F", "C"]);
  });

  it("voicing 6 suena un poco más grave que la séptima en estado fundamental", () => {
    const inv = buildChord({ ...base, voicing: 6 });
    const seventh = buildChord({ ...base, voicing: 3 });
    expect(Math.min(...inv)).toBeLessThan(seventh[0]);
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
  it("etiqueta grado V mayor voicing 3 como Gmaj7", () => {
    const d = describeChord({ ...base, degree: 5, voicing: 3 });
    expect(d.root).toBe("G");
    expect(d.symbol).toBe("Gmaj7");
    expect(d.label).toContain("Gmaj7");
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

  it("voicing 6 se etiqueta como séptima en 1ª inversión (maj7/inv, m7/inv)", () => {
    expect(describeChord({ ...base, voicing: 6 }).symbol).toBe("Cmaj7/inv");
    expect(
      describeChord({ ...base, degree: 2, quality: "minor", voicing: 6 }).symbol,
    ).toBe("Dm7/inv");
  });
});

describe("modo de la tonalidad: 12 mayores + 12 menores", () => {
  it("en modo menor los grados salen de la escala menor natural (A menor: I-VII = A B C D E F G)", () => {
    const roots = [1, 2, 3, 4, 5, 6, 7].map(
      (degree) =>
        chordNoteNames({
          ...base,
          key: "A",
          keyMode: "minor",
          degree,
        })[0],
    );
    expect(roots).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  });

  it("C menor grado III = Eb y grado VII = Bb (no E ni B, y con bemoles)", () => {
    expect(
      chordNoteNames({ ...base, keyMode: "minor", degree: 3 })[0],
    ).toBe("Eb");
    expect(
      chordNoteNames({ ...base, keyMode: "minor", degree: 7 })[0],
    ).toBe("Bb");
  });

  it("el modo mayor no cambia (regresión): C mayor grado VI = A", () => {
    expect(chordNoteNames({ ...base, degree: 6 })[0]).toBe("A");
  });

  it("misma tónica, distinto modo: I comparte raíz, III no", () => {
    const maj = buildChord({ ...base, degree: 3 });
    const min = buildChord({ ...base, keyMode: "minor", degree: 3 });
    expect(buildChord(base)[0]).toBeCloseTo(
      buildChord({ ...base, keyMode: "minor" })[0],
      5,
    );
    expect(min[0]).toBeLessThan(maj[0]);
  });
});

describe("nomenclatura según el círculo de quintas", () => {
  it("las tonalidades mayores del lado bemol se escriben con b", () => {
    expect(keyDisplayName("A#", "major")).toBe("Bb");
    expect(keyDisplayName("D#", "major")).toBe("Eb");
    expect(keyDisplayName("C#", "major")).toBe("Db");
    expect(keyDisplayName("G#", "major")).toBe("Ab");
    expect(keyDisplayName("F", "major")).toBe("F");
  });

  it("las tonalidades del lado sostenido mantienen #", () => {
    expect(keyDisplayName("F#", "major")).toBe("F#");
    expect(keyDisplayName("A", "major")).toBe("A");
    expect(keyDisplayName("C#", "minor")).toBe("C#");
    expect(keyDisplayName("G#", "minor")).toBe("G#");
  });

  it("una misma tónica cambia de grafía según el modo (Db mayor / C# menor)", () => {
    expect(keyDisplayName("C#", "major")).toBe("Db");
    expect(keyDisplayName("C#", "minor")).toBe("C#");
  });

  it("las notas del acorde heredan la grafía de la tonalidad", () => {
    // F mayor, grado IV = Bb mayor → Bb D F (no A#).
    expect(
      chordNoteNames({ ...base, key: "F", degree: 4 }),
    ).toEqual(["Bb", "D", "F"]);
    // E mayor, grado I → E G# B (lado sostenido).
    expect(
      chordNoteNames({ ...base, key: "E", degree: 1 }),
    ).toEqual(["E", "G#", "B"]);
  });

  it("describeChord usa la raíz con la grafía de la tonalidad", () => {
    const d = describeChord({ ...base, key: "D#", degree: 1 });
    expect(d.root).toBe("Eb");
    expect(d.label).toContain("Eb");
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
