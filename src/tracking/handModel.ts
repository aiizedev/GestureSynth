/**
 * Modelo de manos — PURO: sin DOM, sin `@mediapipe/tasks-vision`, sin `tone`.
 *
 * Contiene los tipos que circulan hacia la UI (`HandsFrame` / `HandObservation`)
 * y los helpers testeables que `HandLandmarker.ts` usa para traducir el
 * resultado crudo de MediaPipe: corrección de handedness por el espejo de la
 * cámara, reparto izquierda/derecha y suavizado de landmarks.
 *
 * NO produce `GestureState` — eso es de un paso posterior (ver `HandTracker.ts`).
 */

/** Landmark normalizado: `x`,`y` en 0..1 sobre el frame de vídeo; `z` relativo. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type Handedness = "left" | "right";

export interface HandObservation {
  /** Lado ya corregido para el espejo: la mano real del usuario. */
  handedness: Handedness;
  /** Etiqueta lista para pintar: "Izquierda" / "Derecha". */
  label: string;
  /** Confianza de la clasificación de handedness, 0..1. */
  score: number;
  /** 21 landmarks (ver `LANDMARK_NAMES`), ya suavizados. */
  landmarks: Landmark[];
}

export interface HandsFrame {
  hands: HandObservation[];
  /** `performance.now()` del frame en que se hizo la detección. */
  timestampMs: number;
}

/** Nombres de los 21 landmarks, en el orden que devuelve MediaPipe. */
export const LANDMARK_NAMES = [
  "WRIST",
  "THUMB_CMC",
  "THUMB_MCP",
  "THUMB_IP",
  "THUMB_TIP",
  "INDEX_MCP",
  "INDEX_PIP",
  "INDEX_DIP",
  "INDEX_TIP",
  "MIDDLE_MCP",
  "MIDDLE_PIP",
  "MIDDLE_DIP",
  "MIDDLE_TIP",
  "RING_MCP",
  "RING_PIP",
  "RING_DIP",
  "RING_TIP",
  "PINKY_MCP",
  "PINKY_PIP",
  "PINKY_DIP",
  "PINKY_TIP",
] as const;

/**
 * Las 21 aristas del esqueleto de la mano (palma + 5 dedos). Se definen aquí,
 * y no se importan de `@mediapipe/tasks-vision`, para que el canvas de overlay
 * no tenga que tocar la librería de visión (regla de aislamiento).
 */
export const HAND_CONNECTIONS: readonly (readonly [number, number])[] = [
  // palma
  [0, 1],
  [0, 5],
  [5, 9],
  [9, 13],
  [13, 17],
  [0, 17],
  // pulgar
  [1, 2],
  [2, 3],
  [3, 4],
  // índice
  [5, 6],
  [6, 7],
  [7, 8],
  // corazón
  [9, 10],
  [10, 11],
  [11, 12],
  // anular
  [13, 14],
  [14, 15],
  [15, 16],
  // meñique
  [17, 18],
  [18, 19],
  [19, 20],
];

/**
 * Devuelve el lado tal y como lo percibe el usuario mirándose en la pantalla.
 *
 * MediaPipe ya etiqueta la mano como en un selfie: su "Right" es la mano que el
 * usuario ve a su derecha en el preview espejado. En `/gesture` el preview SÍ se
 * muestra espejado (`mirroredPreview === true`) → se respeta la etiqueta de
 * MediaPipe. Solo si el preview NO estuviera espejado habría que invertirla.
 * (Verificado con webcam real 2026-09-01: sin inversión = correcto.)
 */
export function correctHandedness(raw: string, mirroredPreview: boolean): Handedness {
  const asLeft = raw.trim().toLowerCase().startsWith("l");
  const detected: Handedness = asLeft ? "left" : "right";
  if (mirroredPreview) return detected;
  return detected === "left" ? "right" : "left";
}

/** "Izquierda" / "Derecha" para pintar. */
export function handednessLabel(h: Handedness): string {
  return h === "left" ? "Izquierda" : "Derecha";
}

/**
 * Reparte las manos observadas en los slots `left` / `right`. Caso normal: una
 * de cada. Si MediaPipe devolviera dos con la misma handedness (raro, manos
 * cruzadas), desempata por la X de la muñeca (landmark 0) en el frame crudo:
 * la de menor X va a `left`.
 */
export function assignHands(hands: HandObservation[]): {
  left?: HandObservation;
  right?: HandObservation;
} {
  const out: { left?: HandObservation; right?: HandObservation } = {};
  for (const hand of hands) {
    const slot = hand.handedness;
    const clash = out[slot];
    if (!clash) {
      out[slot] = hand;
      continue;
    }
    const wristX = (h: HandObservation) => h.landmarks[0]?.x ?? 0.5;
    const [lower, higher] =
      wristX(hand) <= wristX(clash) ? [hand, clash] : [clash, hand];
    out.left = lower;
    out.right = higher;
  }
  return out;
}

/**
 * Suavizado EMA por coordenada. `alpha` es el peso del frame NUEVO
 * (`alpha === 1` → sin suavizar). Si no hay frame previo, o cambió el número de
 * puntos, devuelve `next` sin tocar.
 */
export function smoothLandmarks(
  prev: Landmark[] | null,
  next: Landmark[],
  alpha: number,
): Landmark[] {
  if (!prev || prev.length !== next.length) return next;
  const a = Math.max(0, Math.min(1, alpha));
  return next.map((n, i) => ({
    x: prev[i].x + a * (n.x - prev[i].x),
    y: prev[i].y + a * (n.y - prev[i].y),
    z: prev[i].z + a * (n.z - prev[i].z),
  }));
}
