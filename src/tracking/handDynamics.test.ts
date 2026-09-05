import { describe, expect, it } from "vitest";
import type { HandObservation, Landmark } from "./handModel";
import {
  DRIVE_FULL_HEIGHT,
  DRIVE_MAX,
  DRIVE_THRESHOLD,
  FULL_BOOST_HEIGHT,
  NEUTRAL_HEIGHT,
  VOLUME_MAX_DB,
  VOLUME_MIN_DB,
  dynamicsFromHeight,
  handHeight,
  readDynamics,
} from "./handDynamics";

/** Mano con la muñeca (landmark 0) a la `y` dada. */
function handAtY(y: number): HandObservation {
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  lm[0] = { x: 0.5, y, z: 0 };
  return { handedness: "right", label: "Derecha", score: 0.9, landmarks: lm };
}

describe("handHeight", () => {
  it("invierte la y de MediaPipe: y=0 (arriba) → 1, y=1 (abajo) → 0", () => {
    expect(handHeight(handAtY(0))).toBe(1);
    expect(handHeight(handAtY(1))).toBe(0);
    expect(handHeight(handAtY(0.25))).toBeCloseTo(0.75);
  });

  it("recorta fuera de 0..1", () => {
    expect(handHeight(handAtY(-0.3))).toBe(1);
    expect(handHeight(handAtY(1.4))).toBe(0);
  });
});

describe("dynamicsFromHeight", () => {
  it("volumen: mano abajo → VOLUME_MIN_DB, arriba → VOLUME_MAX_DB", () => {
    expect(dynamicsFromHeight(0).volumeDb).toBe(VOLUME_MIN_DB);
    expect(dynamicsFromHeight(1).volumeDb).toBe(VOLUME_MAX_DB);
  });

  it("punto en común: a la altura neutra el volumen es 0 dB (unity = de diseño)", () => {
    expect(dynamicsFromHeight(NEUTRAL_HEIGHT).volumeDb).toBe(0);
    expect(dynamicsFromHeight(NEUTRAL_HEIGHT - 0.1).volumeDb).toBeLessThan(0);
    expect(dynamicsFromHeight(NEUTRAL_HEIGHT + 0.1).volumeDb).toBeGreaterThan(0);
  });

  it("el realce máximo se alcanza en FULL_BOOST_HEIGHT, sin llegar al borde", () => {
    expect(dynamicsFromHeight(FULL_BOOST_HEIGHT).volumeDb).toBe(VOLUME_MAX_DB);
    expect(dynamicsFromHeight(0.95).volumeDb).toBe(VOLUME_MAX_DB);
  });

  it("volumen: sube de forma monótona con la altura", () => {
    const low = dynamicsFromHeight(0.2).volumeDb;
    const mid = dynamicsFromHeight(0.5).volumeDb;
    const high = dynamicsFromHeight(0.8).volumeDb;
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it("sin drive por debajo del umbral", () => {
    expect(dynamicsFromHeight(0).drive).toBe(0);
    expect(dynamicsFromHeight(NEUTRAL_HEIGHT).drive).toBe(0);
    expect(dynamicsFromHeight(DRIVE_THRESHOLD).drive).toBe(0);
    expect(dynamicsFromHeight(DRIVE_THRESHOLD - 0.01).drive).toBe(0);
  });

  it("drive entra pasado el umbral y llega a DRIVE_MAX en DRIVE_FULL_HEIGHT", () => {
    const mid = (DRIVE_THRESHOLD + DRIVE_FULL_HEIGHT) / 2;
    expect(dynamicsFromHeight(mid).drive).toBeGreaterThan(0);
    expect(dynamicsFromHeight(mid).drive).toBeLessThan(DRIVE_MAX);
    expect(dynamicsFromHeight(DRIVE_FULL_HEIGHT).drive).toBeCloseTo(DRIVE_MAX, 5);
    expect(dynamicsFromHeight(1).drive).toBeCloseTo(DRIVE_MAX, 5);
  });

  it("drive crece de forma monótona por encima del umbral", () => {
    const a = dynamicsFromHeight(DRIVE_THRESHOLD + 0.03).drive;
    const b = dynamicsFromHeight(DRIVE_FULL_HEIGHT - 0.03).drive;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });
});

describe("readDynamics", () => {
  it("sin mano derecha → null", () => {
    expect(readDynamics(undefined)).toBeNull();
  });

  it("con mano derecha alta → volumen alto y algo de drive", () => {
    const d = readDynamics(handAtY(0.1))!;
    expect(d.volumeDb).toBeGreaterThan(dynamicsFromHeight(0.5).volumeDb);
    expect(d.drive).toBeGreaterThan(0);
  });

  it("con mano derecha baja → volumen bajo y sin drive", () => {
    const d = readDynamics(handAtY(0.9))!;
    expect(d.volumeDb).toBeLessThan(dynamicsFromHeight(0.5).volumeDb);
    expect(d.drive).toBe(0);
  });
});
