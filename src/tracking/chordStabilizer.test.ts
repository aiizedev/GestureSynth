import { describe, expect, it } from "vitest";
import type { ChordIntent } from "../utils/gestureMapping";
import { makeChordStabilizer } from "./chordStabilizer";

const base: ChordIntent = {
  key: "C",
  keyMode: "major",
  degree: 1,
  quality: "major",
  voicing: 1,
  octave: 0,
};

const chord = (over: Partial<ChordIntent> = {}): ChordIntent => ({ ...base, ...over });

describe("makeChordStabilizer", () => {
  it("sin ninguna lectura todavía → null", () => {
    const s = makeChordStabilizer();
    expect(s(null)).toBeNull();
    expect(s(null)).toBeNull();
  });

  it("el primer acorde se confirma sin latencia", () => {
    const s = makeChordStabilizer();
    expect(s(chord())?.chord).toEqual(chord());
  });

  it("el trigger necesita attackFrames frames con mano (histéresis de ataque)", () => {
    const s = makeChordStabilizer({ attackFrames: 2 });
    expect(s(chord())?.triggerActive).toBe(false); // frame 1
    expect(s(chord())?.triggerActive).toBe(true); // frame 2
  });

  it("un acorde nuevo no suena hasta repetirse holdFrames frames seguidos", () => {
    const s = makeChordStabilizer({ holdFrames: 3, attackFrames: 1 });
    s(chord({ degree: 1 })); // confirma el primero
    expect(s(chord({ degree: 5 }))?.chord.degree).toBe(1); // 1/3
    expect(s(chord({ degree: 5 }))?.chord.degree).toBe(1); // 2/3
    expect(s(chord({ degree: 5 }))?.chord.degree).toBe(5); // 3/3 → confirma
  });

  it("los grados intermedios de una transición no llegan a confirmarse", () => {
    const s = makeChordStabilizer({ holdFrames: 3, attackFrames: 1 });
    s(chord({ degree: 2 })); // confirmado
    // Barrido 2 → 5 pasando por 3 y 4, un frame cada uno, luego 5 estable.
    expect(s(chord({ degree: 3 }))?.chord.degree).toBe(2);
    expect(s(chord({ degree: 4 }))?.chord.degree).toBe(2);
    expect(s(chord({ degree: 5 }))?.chord.degree).toBe(2);
    expect(s(chord({ degree: 5 }))?.chord.degree).toBe(2);
    expect(s(chord({ degree: 5 }))?.chord.degree).toBe(5);
  });

  it("volver al acorde confirmado resetea el candidato en curso", () => {
    const s = makeChordStabilizer({ holdFrames: 3, attackFrames: 1 });
    s(chord({ degree: 1 }));
    s(chord({ degree: 5 })); // 1/3 hacia el 5
    s(chord({ degree: 5 })); // 2/3
    expect(s(chord({ degree: 1 }))?.chord.degree).toBe(1); // vuelve → sigue en 1
    expect(s(chord({ degree: 5 }))?.chord.degree).toBe(1); // el 5 empieza de cero: 1/3
  });

  it("un frame suelto sin mano no suelta el trigger (histéresis de release)", () => {
    const s = makeChordStabilizer({ attackFrames: 1, releaseFrames: 3 });
    s(chord());
    expect(s(null)?.triggerActive).toBe(true); // 1 sin mano
    expect(s(null)?.triggerActive).toBe(true); // 2 sin mano
    expect(s(null)?.triggerActive).toBe(false); // 3 sin mano → suelta
  });

  it("mantiene el último acorde confirmado cuando se pierde la mano", () => {
    const s = makeChordStabilizer({ attackFrames: 1, releaseFrames: 2 });
    s(chord({ degree: 4 }));
    const out = s(null);
    expect(out?.chord.degree).toBe(4);
  });

  it("perder la mano descarta un candidato a medio confirmar", () => {
    const s = makeChordStabilizer({ holdFrames: 3, attackFrames: 1, releaseFrames: 5 });
    s(chord({ degree: 1 }));
    s(chord({ degree: 5 })); // 1/3
    s(chord({ degree: 5 })); // 2/3
    s(null); // se pierde la mano → candidato descartado
    expect(s(chord({ degree: 5 }))?.chord.degree).toBe(1); // el 5 vuelve a empezar
    expect(s(chord({ degree: 5 }))?.chord.degree).toBe(1);
    expect(s(chord({ degree: 5 }))?.chord.degree).toBe(5);
  });

  it("recupera el trigger tras un hueco largo sin re-confirmar el acorde", () => {
    const s = makeChordStabilizer({ attackFrames: 2, releaseFrames: 2 });
    s(chord({ degree: 3 }));
    s(chord({ degree: 3 })); // trigger activo
    s(null);
    expect(s(null)?.triggerActive).toBe(false);
    expect(s(chord({ degree: 3 }))?.triggerActive).toBe(false); // 1/2 de ataque
    const back = s(chord({ degree: 3 }));
    expect(back?.triggerActive).toBe(true);
    expect(back?.chord.degree).toBe(3);
  });
});
