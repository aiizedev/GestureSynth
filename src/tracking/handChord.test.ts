import { describe, expect, it } from "vitest";
import type { HandObservation, Landmark } from "./handModel";
import { readChordIntent } from "./handChord";

interface PoseSpec {
  thumb?: boolean;
  index?: boolean;
  middle?: boolean;
  ring?: boolean;
  pinky?: boolean;
  tilt?: "left" | "right";
  handedness?: "left" | "right";
}

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

  const knuckleX = spec.tilt === "right" ? 0.41 : spec.tilt === "left" ? 0.59 : 0.5;
  lm[9] = { x: knuckleX, y: 0.5, z: 0 };
  lm[13] = { x: knuckleX, y: 0.5, z: 0 };

  const hd = spec.handedness ?? "left";
  lm[3] = { x: 0.5, y: 0.5, z: 0 };
  const away = hd === "right" ? 0.6 : 0.4;
  const tucked = hd === "right" ? 0.4 : 0.6;
  lm[4] = { x: spec.thumb ? away : tucked, y: 0.5, z: 0 };

  return {
    handedness: hd,
    label: hd === "left" ? "Izquierda" : "Derecha",
    score: 0.95,
    landmarks: lm,
  };
}

const left = (s: Omit<PoseSpec, "handedness">) => pose({ ...s, handedness: "left" });
const right = (s: Omit<PoseSpec, "handedness">) => pose({ ...s, handedness: "right" });

describe("readChordIntent", () => {
  it("sin mano izquierda → null", () => {
    expect(readChordIntent(undefined, right({ index: true }), "C", "major")).toBeNull();
  });

  it("puño izquierdo (sin grado legible) → null", () => {
    expect(readChordIntent(left({}), undefined, "C", "major")).toBeNull();
  });

  it("izquierda 1 dedo + inclinada a la derecha → grado 1 mayor, tríada", () => {
    expect(
      readChordIntent(left({ index: true, tilt: "right" }), undefined, "C", "major"),
    ).toEqual({
      key: "C",
      keyMode: "major",
      degree: 1,
      quality: "major",
      voicing: 1,
      octave: 0,
    });
  });

  it("izquierda inclinada a la izquierda → menor; derecha índice+corazón → séptima (voicing 3)", () => {
    const c = readChordIntent(
      left({ index: true, tilt: "left" }),
      right({ index: true, middle: true }),
      "G",
      "major",
    );
    expect(c).toMatchObject({ key: "G", degree: 1, quality: "minor", voicing: 3 });
  });

  it("pulgar derecho → 1ª inversión: séptima → voicing 6, dominante → 7, aum/dim → 8", () => {
    const seventh = readChordIntent(
      left({ index: true, tilt: "right" }),
      right({ thumb: true, index: true, middle: true }),
      "C",
      "major",
    );
    expect(seventh?.voicing).toBe(6);

    const dominant = readChordIntent(
      left({ index: true, tilt: "right" }),
      right({ thumb: true, index: true, middle: true, ring: true }),
      "C",
      "major",
    );
    expect(dominant?.voicing).toBe(7);

    const altered = readChordIntent(
      left({ index: true, tilt: "right" }),
      right({ thumb: true, index: true, middle: true, ring: true, pinky: true }),
      "C",
      "major",
    );
    expect(altered?.voicing).toBe(8);
  });

  it("degrado 1..7 con VI/VII de la digitación de la referencia", () => {
    const g6 = readChordIntent(left({ index: true, pinky: true, tilt: "right" }), undefined, "C", "major");
    expect(g6?.degree).toBe(6);
    const g7 = readChordIntent(
      left({ thumb: true, index: true, pinky: true, tilt: "right" }),
      undefined,
      "C",
      "major",
    );
    expect(g7?.degree).toBe(7);
  });
});
