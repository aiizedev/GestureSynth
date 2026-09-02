import { describe, expect, it } from "vitest";
import {
  assignHands,
  correctHandedness,
  HAND_CONNECTIONS,
  handednessLabel,
  LANDMARK_NAMES,
  smoothLandmarks,
  type HandObservation,
  type Landmark,
} from "./handModel";

function pts(fill = 0): Landmark[] {
  return Array.from({ length: 21 }, () => ({ x: fill, y: fill, z: fill }));
}

function hand(handedness: "left" | "right", wristX: number): HandObservation {
  const landmarks = pts(0.5);
  landmarks[0] = { x: wristX, y: 0.5, z: 0 };
  return { handedness, label: handednessLabel(handedness), score: 0.9, landmarks };
}

describe("HAND_CONNECTIONS", () => {
  it("tiene 21 aristas con índices válidos y sin duplicados", () => {
    expect(HAND_CONNECTIONS).toHaveLength(21);
    const seen = new Set<string>();
    for (const [a, b] of HAND_CONNECTIONS) {
      expect(Number.isInteger(a) && a >= 0 && a <= 20).toBe(true);
      expect(Number.isInteger(b) && b >= 0 && b <= 20).toBe(true);
      expect(a).not.toBe(b);
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("forma un grafo conexo que toca los 21 landmarks", () => {
    const adj = new Map<number, number[]>();
    const link = (from: number, to: number) => {
      const list = adj.get(from) ?? [];
      list.push(to);
      adj.set(from, list);
    };
    for (const [a, b] of HAND_CONNECTIONS) {
      link(a, b);
      link(b, a);
    }
    const seen = new Set<number>([0]);
    const stack = [0];
    while (stack.length) {
      for (const n of adj.get(stack.pop()!) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    expect(seen.size).toBe(21);
  });
});

describe("LANDMARK_NAMES", () => {
  it("son 21, empieza en WRIST y acaba en PINKY_TIP", () => {
    expect(LANDMARK_NAMES).toHaveLength(21);
    expect(LANDMARK_NAMES[0]).toBe("WRIST");
    expect(LANDMARK_NAMES[20]).toBe("PINKY_TIP");
  });
});

describe("correctHandedness", () => {
  it("con preview espejado (caso de /gesture) respeta la etiqueta de MediaPipe", () => {
    expect(correctHandedness("Left", true)).toBe("left");
    expect(correctHandedness("Right", true)).toBe("right");
  });

  it("con preview sin espejar invierte la etiqueta", () => {
    expect(correctHandedness("Left", false)).toBe("right");
    expect(correctHandedness("Right", false)).toBe("left");
  });

  it("tolera mayúsculas/minúsculas y espacios", () => {
    expect(correctHandedness(" left ", true)).toBe("left");
    expect(correctHandedness("RIGHT", true)).toBe("right");
  });
});

describe("assignHands", () => {
  it("reparte una mano de cada lado", () => {
    const roles = assignHands([hand("left", 0.3), hand("right", 0.7)]);
    expect(roles.left?.handedness).toBe("left");
    expect(roles.right?.handedness).toBe("right");
  });

  it("con dos manos del mismo lado desempata por X de la muñeca", () => {
    const roles = assignHands([hand("left", 0.8), hand("left", 0.2)]);
    expect(roles.left?.landmarks[0].x).toBe(0.2);
    expect(roles.right?.landmarks[0].x).toBe(0.8);
  });

  it("con una sola mano deja el otro slot vacío; sin manos, ambos vacíos", () => {
    const one = assignHands([hand("right", 0.5)]);
    expect(one.right).toBeDefined();
    expect(one.left).toBeUndefined();

    const none = assignHands([]);
    expect(none.left).toBeUndefined();
    expect(none.right).toBeUndefined();
  });
});

describe("smoothLandmarks", () => {
  it("sin frame previo devuelve el nuevo tal cual", () => {
    const next = pts(1);
    expect(smoothLandmarks(null, next, 0.5)).toBe(next);
  });

  it("con alpha 0.5 es la media exacta entre previo y nuevo", () => {
    const out = smoothLandmarks(pts(0), pts(1), 0.5);
    expect(out[0]).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
    expect(out[20]).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
  });

  it("con alpha 1 no suaviza (todo el frame nuevo)", () => {
    const out = smoothLandmarks(pts(0), pts(0.8), 1);
    expect(out[5].x).toBeCloseTo(0.8, 10);
  });

  it("si cambia el número de puntos devuelve el nuevo sin romper", () => {
    const next = pts(0.4);
    expect(smoothLandmarks([{ x: 0, y: 0, z: 0 }], next, 0.5)).toBe(next);
  });
});
