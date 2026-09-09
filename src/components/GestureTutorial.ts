/**
 * Tutorial guiado de `/gesture` — sin `@mediapipe/tasks-vision`, sin `tone`.
 *
 * Tras una pantalla partida de ~3,5 s (izquierda = grado, derecha = voicing),
 * el tutorial es una PROGRESIÓN guiada: cada paso explica qué vamos a tocar y
 * cómo ("sube el índice de la mano derecha para tocar I", …); en cuanto el
 * usuario mantiene el acorde unos frames se le confirma qué está tocando
 * durante `CHORD_MS` (4 s) y sólo entonces aparece la siguiente instrucción.
 *
 * Progresión (todos en 1ª inversión salvo el primer I):
 *   I · I(inv) · Imaj7 · I7 · IV · I · V · V7 · I · ii · V · I
 * En `V7` se recuerda que subir la mano derecha da volumen y distorsión; en
 * `ii` se explica que inclinar la mano izquierda a la izquierda hace los
 * acordes menores.
 *
 * No toca el audio: solo lee los frames para saber cuándo avanzar y pinta la
 * guía. El sonido lo produce el pipeline de siempre (`readChordIntent` ve grado
 * + voicing + inclinación y dispara el `Synth`).
 */
import {
  assignHands,
  type HandObservation,
  type HandsFrame,
} from "../tracking/handModel";
import { readDegree, readQuality, readVoicing } from "../tracking/handPose";

/** ms de pantalla partida antes de pedir el primer acorde. */
const SPLIT_MS = 3500;
/** Frames seguidos con el acorde correcto para confirmarlo (~250 ms a 20 fps). */
const HOLD_FRAMES = 5;
/** ms que se mantiene el mensaje "estás tocando…" antes de la siguiente instrucción. */
const CHORD_MS = 4000;
/** ms del resumen final antes de cerrar. */
const DONE_MS = 2200;

type Shape = "root" | "seventh" | "dominant";

interface PlayStep {
  /** Grado esperado en la mano izquierda (1..7). */
  degree: number;
  /** Forma esperada en la mano derecha. */
  shape: Shape;
  /** ¿Con pulgar derecho (1ª inversión)? */
  inverted: boolean;
  /** `true` → exige inclinación a la izquierda (menor); `false` → no-menor. */
  minor: boolean;
  /** Instrucción mientras se espera el gesto. */
  prompt: string;
  /** Pista corta bajo la instrucción. */
  hint: string;
  /** Mensaje "estás tocando…" (dura `CHORD_MS`). */
  ack: string;
}

const SEQUENCE: readonly PlayStep[] = [
  {
    degree: 1,
    shape: "root",
    inverted: false,
    minor: false,
    prompt: "Sube el índice de las DOS manos para tocar I",
    hint: "izquierda: nº de dedos = grado (1 = I) · derecha: el índice hace sonar el acorde",
    ack: "Estás tocando el acorde I",
  },
  {
    degree: 1,
    shape: "root",
    inverted: true,
    minor: false,
    prompt: "Añade el PULGAR de la mano derecha para tocar I en primera inversión",
    hint: "el pulgar sube el bajo una octava; el resto de la progresión va igual",
    ack: "Primera inversión: el resto de la progresión va también así",
  },
  {
    degree: 1,
    shape: "seventh",
    inverted: true,
    minor: false,
    prompt: "Añade el dedo MEDIO de la mano derecha para tocar Imaj7",
    hint: "índice + medio en la derecha = séptima mayor",
    ack: "Estás tocando Imaj7",
  },
  {
    degree: 1,
    shape: "dominant",
    inverted: true,
    minor: false,
    prompt: "Añade el dedo ANULAR de la mano derecha para tocar I7",
    hint: "índice + medio + anular = séptima dominante",
    ack: "Estás tocando I7",
  },
  {
    degree: 4,
    shape: "root",
    inverted: true,
    minor: false,
    prompt:
      "Baja el medio y el anular de la mano DERECHA para volver a la tríada; en la mano IZQUIERDA levanta 4 dedos para tocar IV",
    hint: "derecha: índice + pulgar = tríada en 1ª inversión · izquierda: nº de dedos = grado (4 = IV)",
    ack: "Estás tocando IV",
  },
  {
    degree: 1,
    shape: "root",
    inverted: true,
    minor: false,
    prompt: "Vuelve a 1 dedo en la mano izquierda para tocar I",
    hint: "1 dedo = grado I",
    ack: "Estás tocando I",
  },
  {
    degree: 5,
    shape: "root",
    inverted: true,
    minor: false,
    prompt: "Levanta los 5 dedos de la mano izquierda para tocar V",
    hint: "5 dedos = grado V",
    ack: "Estás tocando V",
  },
  {
    degree: 5,
    shape: "dominant",
    inverted: true,
    minor: false,
    prompt: "Añade medio y anular en la mano derecha para tocar V7",
    hint: "sube la mano derecha para más volumen y distorsión",
    ack: "Estás tocando V7. Sube la mano derecha para más volumen y distorsión",
  },
  {
    degree: 1,
    shape: "root",
    inverted: true,
    minor: false,
    prompt:
      "Baja el medio y el anular de la mano DERECHA para volver a la tríada, y baja la mano para volver al volumen normal; deja 1 dedo en la mano IZQUIERDA para tocar I",
    hint: "derecha: índice + pulgar = tríada, mano a media altura · izquierda: 1 dedo = grado I",
    ack: "Estás tocando I",
  },
  {
    degree: 2,
    shape: "root",
    inverted: true,
    minor: true,
    prompt: "Pon 2 dedos en la izquierda e inclínala a la IZQUIERDA para tocar ii",
    hint: "inclinar la mano izquierda a la izquierda hace el acorde menor",
    ack: "Inclinar la izquierda a la izquierda lo hace menor: estás tocando ii",
  },
  {
    degree: 5,
    shape: "root",
    inverted: true,
    minor: false,
    prompt: "5 dedos en la izquierda, vuelve a inclinarla a la DERECHA para tocar V",
    hint: "inclinar a la derecha vuelve a mayor",
    ack: "Estás tocando V",
  },
  {
    degree: 1,
    shape: "root",
    inverted: true,
    minor: false,
    prompt: "1 dedo en la mano izquierda para tocar I",
    hint: "resolvemos en I",
    ack: "Estás tocando I",
  },
];

/** ¿La lectura de las dos manos coincide con el acorde que pide `step`? */
function matches(
  step: PlayStep,
  left: HandObservation | undefined,
  right: HandObservation | undefined,
): boolean {
  if (!left || !right) return false;
  if (readDegree(left) !== step.degree) return false;
  const v = readVoicing(right);
  if (!v || v.shape !== step.shape || v.inverted !== step.inverted) return false;
  const q = readQuality(left);
  return step.minor ? q === "minor" : q !== "minor";
}

export class GestureTutorial {
  readonly element: HTMLDivElement;

  private readonly promptEl: HTMLDivElement;
  private readonly hintEl: HTMLDivElement;
  private readonly leftHalf: HTMLDivElement;
  private readonly rightHalf: HTMLDivElement;
  private readonly onDone: () => void;

  private phase: "split" | "play" | "done" = "split";
  private idx = 0;
  private active = false;
  private acking = false;
  private held = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(onDone: () => void) {
    this.onDone = onDone;

    this.element = document.createElement("div");
    this.element.className = "gesture-tutorial";
    this.element.hidden = true;

    const split = document.createElement("div");
    split.className = "gt-split";
    this.leftHalf = document.createElement("div");
    this.leftHalf.className = "gt-half gt-left";
    this.leftHalf.innerHTML =
      `<span class="gt-tag">Mano izquierda</span>` +
      `<span class="gt-sub">grado del acorde</span>`;
    this.rightHalf = document.createElement("div");
    this.rightHalf.className = "gt-half gt-right";
    this.rightHalf.innerHTML =
      `<span class="gt-tag">Mano derecha</span>` +
      `<span class="gt-sub">voicing + volumen</span>`;
    split.append(this.leftHalf, this.rightHalf);

    this.promptEl = document.createElement("div");
    this.promptEl.className = "gt-prompt";
    this.hintEl = document.createElement("div");
    this.hintEl.className = "gt-hint";

    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "gt-skip";
    skip.textContent = "Saltar tutorial";
    skip.addEventListener("click", () => this.finish());

    this.element.append(split, this.promptEl, this.hintEl, skip);
  }

  /** ¿Está corriendo el tutorial? */
  get running(): boolean {
    return this.active;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.acking = false;
    this.idx = 0;
    this.held = 0;
    this.phase = "split";
    this.element.hidden = false;

    this.element.classList.add("gt-splitmode");
    this.leftHalf.classList.remove("is-active");
    this.rightHalf.classList.remove("is-active");
    this.promptEl.classList.remove("gt-ack");
    this.promptEl.textContent =
      "Vamos a tocar una progresión de acordes. Mano IZQUIERDA = grado; mano DERECHA = voicing y volumen.";
    this.hintEl.textContent = "en unos segundos empezamos por el acorde I";

    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.beginPlay(), SPLIT_MS);
  }

  /** Lo llama `GestureView` en cada frame de detección mientras corre. */
  feed(frame: HandsFrame): void {
    if (!this.active || this.phase !== "play" || this.acking) return;
    const { left, right } = assignHands(frame.hands);
    if (matches(SEQUENCE[this.idx], left, right)) {
      this.held += 1;
      if (this.held >= HOLD_FRAMES) this.confirm();
    } else {
      this.held = 0;
    }
  }

  /** Corta el tutorial (botón "saltar" o fin de secuencia). */
  finish(): void {
    if (!this.active) return;
    this.active = false;
    this.acking = false;
    this.phase = "done";
    clearTimeout(this.timer);
    this.timer = undefined;
    this.element.hidden = true;
    this.onDone();
  }

  private beginPlay(): void {
    this.phase = "play";
    this.element.classList.remove("gt-splitmode");
    this.leftHalf.classList.add("is-active");
    this.rightHalf.classList.add("is-active");
    this.showStep();
  }

  private showStep(): void {
    const step = SEQUENCE[this.idx];
    this.held = 0;
    this.promptEl.classList.remove("gt-ack");
    this.promptEl.textContent = step.prompt;
    this.hintEl.textContent = step.hint;
  }

  /**
   * Acorde conseguido: muestra "estás tocando…" durante `CHORD_MS` y luego
   * encadena el siguiente paso (o el cierre). Mientras dura, `feed` no procesa.
   */
  private confirm(): void {
    this.acking = true;
    this.held = 0;
    clearTimeout(this.timer);
    this.promptEl.textContent = SEQUENCE[this.idx].ack;
    this.promptEl.classList.add("gt-ack");
    this.hintEl.textContent = "";
    this.timer = setTimeout(() => {
      this.acking = false;
      this.idx += 1;
      if (this.idx >= SEQUENCE.length) this.goDone();
      else this.showStep();
    }, CHORD_MS);
  }

  private goDone(): void {
    this.phase = "done";
    this.promptEl.classList.remove("gt-ack");
    this.promptEl.textContent =
      "¡Listo! Ya tocaste la progresión completa. Izquierda = grado, derecha = voicing y volumen";
    this.hintEl.textContent = "inclina la mano izquierda para mayor/menor";
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.finish(), DONE_MS);
  }
}
