import { describe, expect, it } from "vitest";
import type { HandObservation, Landmark } from "./handModel";
import {
  fingerCount,
  fingersUp,
  handTilt,
  readDegree,
  readQuality,
  readVoicing,
  voicingEnum,
} from "./handPose";

interface PoseSpec {
  thumb?: boolean;
  index?: boolean;
  middle?: boolean;
  ring?: boolean;
  pinky?: boolean;
  handedness?: "left" | "right";
  /** Inclinación de la mano: mueve los nudillos 9/13 respecto a la muñeca. */
  tilt?: "left" | "right";
}

/**
 * Sintetiza 21 landmarks para una pose. Dedo largo: PIP en y=0.5, punta en
 * y=0.4 si "arriba" o y=0.6 si curvado. Pulgar: IP en x=0.5; la punta se separa
 * hacia el lado que corresponda a la mano cuando está extendido. `tilt` mueve
 * los nudillos de corazón/anular (9/13) para que `handTilt` los lea.
 */
function pose(spec: PoseSpec): HandObservation {
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const setLong = (pip: number, tip: number, up: boolean | undefined) => {
    lm[pip] = { x: 0.5, y: 0.5, z: 0 };
    lm[tip] = { x: 0.5, y: up ? 0.4 : 0.6, z: 0 };
  };
  setLong(6, 8, spec.index);
  setLong(10, 12, spec.middle);
  setLong(14, 16, spec.ring);
  setLong(18, 20, spec.pinky);

  // "inclinada a la derecha" (visual) → muñeca a la derecha de los nudillos →
  // nudillos a MENOR x que la muñeca (0.5).
  const knuckleX = spec.tilt === "right" ? 0.41 : spec.tilt === "left" ? 0.59 : 0.5;
  lm[9] = { x: knuckleX, y: 0.5, z: 0 };
  lm[13] = { x: knuckleX, y: 0.5, z: 0 };

  const hd = spec.handedness ?? "left";
  lm[3] = { x: 0.5, y: 0.5, z: 0 };
  const away = hd === "right" ? 0.6 : 0.4; // extendido
  const tucked = hd === "right" ? 0.4 : 0.6;
  lm[4] = { x: spec.thumb ? away : tucked, y: 0.5, z: 0 };

  return {
    handedness: hd,
    label: hd === "left" ? "Izquierda" : "Derecha",
    score: 0.95,
    landmarks: lm,
  };
}

describe("fingersUp", () => {
  it("puño cerrado: ningún dedo", () => {
    expect(fingersUp(pose({}))).toEqual({
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    });
  });

  it("detecta índice y meñique arriba, resto abajo", () => {
    const f = fingersUp(pose({ index: true, pinky: true }));
    expect(f).toEqual({
      thumb: false,
      index: true,
      middle: false,
      ring: false,
      pinky: true,
    });
  });

  it("el pulgar depende de la mano (mismo landmark, lado opuesto)", () => {
    const lm = pose({ handedness: "right", thumb: true }).landmarks;
    const asRight: HandObservation = {
      handedness: "right",
      label: "Derecha",
      score: 0.9,
      landmarks: lm,
    };
    const asLeft: HandObservation = { ...asRight, handedness: "left", label: "Izquierda" };
    expect(fingersUp(asRight).thumb).toBe(true);
    expect(fingersUp(asLeft).thumb).toBe(false);
  });
});

describe("fingerCount", () => {
  it("cuenta los dedos extendidos", () => {
    expect(fingerCount(fingersUp(pose({})))).toBe(0);
    expect(fingerCount(fingersUp(pose({ index: true, middle: true, ring: true })))).toBe(3);
    expect(
      fingerCount(
        fingersUp(pose({ thumb: true, index: true, middle: true, ring: true, pinky: true })),
      ),
    ).toBe(5);
  });
});

describe("readDegree", () => {
  it("1..5 dedos → grados 1..5, da igual qué dedos", () => {
    expect(readDegree(pose({ index: true }))).toBe(1);
    expect(readDegree(pose({ middle: true }))).toBe(1); // 1 dedo cualquiera
    expect(readDegree(pose({ index: true, middle: true }))).toBe(2);
    expect(readDegree(pose({ thumb: true, index: true }))).toBe(2); // 2 dedos cualesquiera
    expect(readDegree(pose({ index: true, middle: true, ring: true }))).toBe(3);
    expect(readDegree(pose({ index: true, middle: true, ring: true, pinky: true }))).toBe(4);
    expect(
      readDegree(pose({ thumb: true, index: true, middle: true, ring: true, pinky: true })),
    ).toBe(5);
  });

  it("índice + meñique → grado 6 (digitación de la referencia)", () => {
    expect(readDegree(pose({ index: true, pinky: true }))).toBe(6);
  });

  it("índice + meñique + pulgar → grado 7", () => {
    expect(readDegree(pose({ thumb: true, index: true, pinky: true }))).toBe(7);
  });

  it("índice + meñique + corazón NO es grado 6 (lleva corazón) → cuenta = 3", () => {
    expect(readDegree(pose({ index: true, middle: true, pinky: true }))).toBe(3);
  });

  it("mano cerrada → null", () => {
    expect(readDegree(pose({}))).toBeNull();
  });
});

describe("readVoicing (mano derecha)", () => {
  const right = (spec: Omit<PoseSpec, "handedness">) =>
    readVoicing(pose({ ...spec, handedness: "right" }));

  it("índice → fundamental sin invertir", () => {
    expect(right({ index: true })).toEqual({ shape: "root", inverted: false });
  });

  it("índice + corazón → séptima", () => {
    expect(right({ index: true, middle: true })).toEqual({
      shape: "seventh",
      inverted: false,
    });
  });

  it("índice + corazón + anular → séptima dominante", () => {
    expect(right({ index: true, middle: true, ring: true })).toEqual({
      shape: "dominant",
      inverted: false,
    });
  });

  it("índice → meñique → aumentado / disminuido", () => {
    expect(right({ index: true, middle: true, ring: true, pinky: true })).toEqual({
      shape: "altered",
      inverted: false,
    });
  });

  it("el pulgar añade primera inversión a cualquier forma", () => {
    expect(right({ thumb: true, index: true })).toEqual({
      shape: "root",
      inverted: true,
    });
    expect(right({ thumb: true, index: true, middle: true })).toEqual({
      shape: "seventh",
      inverted: true,
    });
    expect(
      right({ thumb: true, index: true, middle: true, ring: true, pinky: true }),
    ).toEqual({ shape: "altered", inverted: true });
  });

  it("sin índice → null; combinación no contigua (índice+anular) → null", () => {
    expect(right({})).toBeNull();
    expect(right({ thumb: true })).toBeNull();
    expect(right({ index: true, ring: true })).toBeNull();
  });

});

describe("readQuality (inclinación — se lee de la mano izquierda)", () => {
  const q = (spec: Omit<PoseSpec, "handedness">) =>
    readQuality(pose({ ...spec, handedness: "left" }));

  it("inclinada a la derecha → mayor", () => {
    expect(q({ tilt: "right", index: true })).toBe("major");
  });

  it("inclinada a la izquierda → menor", () => {
    expect(q({ tilt: "left", index: true })).toBe("minor");
  });

  it("vertical (zona muerta) → null", () => {
    expect(q({ index: true })).toBeNull();
  });

  it("handTilt: signo derecha positivo, izquierda negativo, centro cero", () => {
    expect(handTilt(pose({ handedness: "left", tilt: "right" }))).toBeGreaterThan(0);
    expect(handTilt(pose({ handedness: "left", tilt: "left" }))).toBeLessThan(0);
    expect(handTilt(pose({ handedness: "left" }))).toBe(0);
  });

  it("da igual la mano: misma inclinación, misma lectura", () => {
    expect(readQuality(pose({ handedness: "right", tilt: "right", index: true }))).toBe(
      "major",
    );
  });
});

describe("voicingEnum (forma → Voicing de musicTheory)", () => {
  it("root/null → 1, seventh → 3, dominant → 4, altered → 5 (ignora inverted)", () => {
    expect(voicingEnum(null)).toBe(1);
    expect(voicingEnum({ shape: "root", inverted: false })).toBe(1);
    expect(voicingEnum({ shape: "root", inverted: true })).toBe(1);
    expect(voicingEnum({ shape: "seventh", inverted: false })).toBe(3);
    expect(voicingEnum({ shape: "seventh", inverted: true })).toBe(3);
    expect(voicingEnum({ shape: "dominant", inverted: false })).toBe(4);
    expect(voicingEnum({ shape: "altered", inverted: false })).toBe(5);
  });
});
