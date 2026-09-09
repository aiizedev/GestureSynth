// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GestureTutorial } from "./GestureTutorial";
import type { HandObservation, HandsFrame, Landmark } from "../tracking/handModel";

type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";
type Tilt = "" | "l" | "r";

const SPLIT_MS = 3500;
const CHORD_MS = 4000;
const DONE_MS = 2200;

/** Mano sintética: `up` = dedos extendidos; `tilt` inclina la muñeca (menor/mayor). */
function hand(handedness: "left" | "right", up: Finger[], tilt: Tilt = ""): HandObservation {
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const setLong = (pip: number, tip: number, isUp: boolean) => {
    lm[pip] = { x: 0.5, y: 0.5, z: 0 };
    lm[tip] = { x: 0.5, y: isUp ? 0.3 : 0.65, z: 0 };
  };
  setLong(6, 8, up.includes("index"));
  setLong(10, 12, up.includes("middle"));
  setLong(14, 16, up.includes("ring"));
  setLong(18, 20, up.includes("pinky"));
  const thumbUp = up.includes("thumb");
  lm[3] = { x: 0.5, y: 0.5, z: 0 };
  lm[4] = {
    x: handedness === "right" ? (thumbUp ? 0.7 : 0.5) : thumbUp ? 0.3 : 0.5,
    y: 0.5,
    z: 0,
  };
  // Inclinación: muñeca (lm[0]) fuera del tramo de nudillos 9/13 (ambos en 0.5).
  if (tilt === "l") lm[0] = { x: 0.44, y: 0.5, z: 0 };
  else if (tilt === "r") lm[0] = { x: 0.56, y: 0.5, z: 0 };
  return { handedness, label: handedness, score: 0.95, landmarks: lm };
}

const ALL: Finger[] = ["index", "middle", "ring", "pinky", "thumb"];
/** Mano izquierda con `n` dedos (1..5) = grado n, e inclinación opcional. */
const LEFT = (n: number, tilt: Tilt = "") => hand("left", ALL.slice(0, n), tilt);

const R_ROOT = () => hand("right", ["index"]);
const R_ROOT_INV = () => hand("right", ["index", "thumb"]);
const R_7_INV = () => hand("right", ["index", "thumb", "middle"]);
const R_DOM_INV = () => hand("right", ["index", "thumb", "middle", "ring"]);

function frame(...hands: HandObservation[]): HandsFrame {
  return { hands, timestampMs: 0 };
}
function feedN(t: GestureTutorial, f: HandsFrame, n: number): void {
  for (let i = 0; i < n; i++) t.feed(f);
}

let onDone: ReturnType<typeof vi.fn>;
let t: GestureTutorial;

beforeEach(() => {
  vi.useFakeTimers();
  onDone = vi.fn();
  t = new GestureTutorial(onDone);
});
afterEach(() => {
  vi.useRealTimers();
});

const prompt = () => t.element.querySelector(".gt-prompt")!.textContent ?? "";
const acking = () =>
  t.element.querySelector(".gt-prompt")!.classList.contains("gt-ack");

/** Toca un acorde (mantener 5 frames) y deja pasar la confirmación (4 s). */
function play(f: HandsFrame): void {
  feedN(t, f, 5);
  vi.advanceTimersByTime(CHORD_MS);
}

describe("GestureTutorial", () => {
  it("arranca en pantalla partida y no corre hasta start()", () => {
    expect(t.running).toBe(false);
    expect(t.element.hidden).toBe(true);

    t.start();
    expect(t.running).toBe(true);
    expect(t.element.hidden).toBe(false);
    expect(t.element.classList.contains("gt-splitmode")).toBe(true);
    expect(prompt()).toMatch(/progresión de acordes/i);
  });

  it("tras ~3,5 s explica el primer acorde (I) con las dos manos", () => {
    t.start();
    vi.advanceTimersByTime(SPLIT_MS);
    expect(t.element.classList.contains("gt-splitmode")).toBe(false);
    expect(prompt()).toMatch(/índice de las DOS manos para tocar I/i);
    expect(t.element.querySelector(".gt-left")!.classList.contains("is-active")).toBe(true);
    expect(t.element.querySelector(".gt-right")!.classList.contains("is-active")).toBe(true);
  });

  it("confirma el acorde durante 4 s antes de la siguiente instrucción", () => {
    t.start();
    vi.advanceTimersByTime(SPLIT_MS);

    feedN(t, frame(LEFT(1), R_ROOT()), 5); // completa el I
    expect(acking()).toBe(true);
    expect(prompt()).toMatch(/tocando el acorde I/i);

    vi.advanceTimersByTime(CHORD_MS - 100); // aún dentro de los 4 s
    expect(acking()).toBe(true);
    feedN(t, frame(LEFT(1), R_ROOT_INV()), 30); // no adelanta nada
    expect(acking()).toBe(true);

    vi.advanceTimersByTime(100); // se cumplen los 4 s
    expect(acking()).toBe(false);
    expect(prompt()).toMatch(/PULGAR/);
  });

  it("recorre I · I(inv) · Imaj7 · I7 · IV · I · V · V7 · I · ii · V · I y cierra", () => {
    t.start();
    vi.advanceTimersByTime(SPLIT_MS);

    expect(prompt()).toMatch(/para tocar I\b/i);
    play(frame(LEFT(1), R_ROOT())); // I

    expect(prompt()).toMatch(/PULGAR/);
    feedN(t, frame(LEFT(1), R_ROOT_INV()), 5);
    expect(prompt()).toMatch(/[Pp]rimera inversión/);
    vi.advanceTimersByTime(CHORD_MS); // I (inv)

    expect(prompt()).toMatch(/MEDIO/);
    play(frame(LEFT(1), R_7_INV())); // Imaj7
    expect(prompt()).toMatch(/ANULAR/);
    play(frame(LEFT(1), R_DOM_INV())); // I7

    play(frame(LEFT(4), R_ROOT_INV())); // IV
    play(frame(LEFT(1), R_ROOT_INV())); // I
    play(frame(LEFT(5), R_ROOT_INV())); // V

    feedN(t, frame(LEFT(5), R_DOM_INV()), 5); // V7
    expect(prompt()).toMatch(/volumen y distorsión/i);
    vi.advanceTimersByTime(CHORD_MS);

    play(frame(LEFT(1), R_ROOT_INV())); // I

    expect(prompt()).toMatch(/inclínala a la izquierda/i);
    feedN(t, frame(LEFT(2, "l"), R_ROOT_INV()), 5); // ii (menor)
    expect(prompt()).toMatch(/menor/i);
    vi.advanceTimersByTime(CHORD_MS);

    play(frame(LEFT(5, "r"), R_ROOT_INV())); // V
    play(frame(LEFT(1), R_ROOT_INV())); // I

    expect(prompt()).toMatch(/Listo/i);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DONE_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(t.running).toBe(false);
    expect(t.element.hidden).toBe(true);
  });

  it("un acorde que no es el pedido no avanza", () => {
    t.start();
    vi.advanceTimersByTime(SPLIT_MS); // paso I (root, sin inversión)

    feedN(t, frame(LEFT(1), R_ROOT_INV()), 10); // inversión: aún no toca
    expect(acking()).toBe(false);
    feedN(t, frame(LEFT(2), R_ROOT()), 10); // grado ii: tampoco
    expect(acking()).toBe(false);
    feedN(t, frame(LEFT(1)), 10); // sin mano derecha: tampoco
    expect(acking()).toBe(false);

    feedN(t, frame(LEFT(1), R_ROOT()), 5); // el correcto sí
    expect(acking()).toBe(true);
  });

  it("el paso 'ii' exige inclinar la mano izquierda a la izquierda", () => {
    t.start();
    vi.advanceTimersByTime(SPLIT_MS);
    play(frame(LEFT(1), R_ROOT())); // I
    play(frame(LEFT(1), R_ROOT_INV())); // I inv
    play(frame(LEFT(1), R_7_INV())); // Imaj7
    play(frame(LEFT(1), R_DOM_INV())); // I7
    play(frame(LEFT(4), R_ROOT_INV())); // IV
    play(frame(LEFT(1), R_ROOT_INV())); // I
    play(frame(LEFT(5), R_ROOT_INV())); // V
    play(frame(LEFT(5), R_DOM_INV())); // V7
    play(frame(LEFT(1), R_ROOT_INV())); // I
    expect(prompt()).toMatch(/inclínala a la izquierda/i);

    feedN(t, frame(LEFT(2), R_ROOT_INV()), 10); // sin inclinar → no cuenta
    expect(acking()).toBe(false);

    feedN(t, frame(LEFT(2, "l"), R_ROOT_INV()), 5); // inclinada → cuenta
    expect(acking()).toBe(true);
    expect(prompt()).toMatch(/menor/i);
  });

  it("'Saltar tutorial' lo cierra al instante", () => {
    t.start();
    vi.advanceTimersByTime(SPLIT_MS);
    t.element.querySelector<HTMLButtonElement>(".gt-skip")!.click();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(t.running).toBe(false);
    expect(t.element.hidden).toBe(true);
  });

  it("feed() no hace nada si el tutorial no está corriendo", () => {
    feedN(t, frame(LEFT(1), R_ROOT()), 20);
    expect(onDone).not.toHaveBeenCalled();
    expect(t.element.hidden).toBe(true);
  });
});
