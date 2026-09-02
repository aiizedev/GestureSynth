/**
 * Lectura de POSE de una mano — PURO: sin DOM, sin `@mediapipe/tasks-vision`,
 * sin `tone`. A partir de un `HandObservation` (21 landmarks + lado) deduce qué
 * dedos están extendidos y, con eso, el grado del acorde que indica la mano.
 *
 * Digitación (mano izquierda = grado del acorde):
 *   1–5 dedos  → grados I–V   (da igual QUÉ dedos, solo el número)
 *   índice + meñique          → grado VI   ┐ misma digitación que la referencia
 *   índice + meñique + pulgar → grado VII  ┘ de Eric Wei (no reaprender)
 *
 * Método de detección igual que la referencia: un dedo (no pulgar) está
 * extendido si su punta queda por encima de la falange PIP (asume la mano en
 * alto, dedos hacia arriba). El pulgar, si la punta se separa lateralmente de
 * la IP (el lado depende de qué mano es, en coordenadas sin espejar).
 */
import type { HandObservation, Landmark } from "./handModel";

export interface FingersUp {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

type LongFinger = "index" | "middle" | "ring" | "pinky";

const PIP_TIP: Record<LongFinger, { pip: number; tip: number }> = {
  index: { pip: 6, tip: 8 },
  middle: { pip: 10, tip: 12 },
  ring: { pip: 14, tip: 16 },
  pinky: { pip: 18, tip: 20 },
};

function longFingerExtended(lm: Landmark[], name: LongFinger): boolean {
  const { pip, tip } = PIP_TIP[name];
  return lm[tip].y < lm[pip].y;
}

function thumbExtended(lm: Landmark[], handedness: "left" | "right"): boolean {
  const tip = lm[4];
  const ip = lm[3];
  // Espacio de landmarks SIN espejar: en la mano derecha el pulgar apunta hacia
  // +x al extenderse; en la izquierda, hacia -x.
  return handedness === "right" ? tip.x > ip.x : tip.x < ip.x;
}

export function fingersUp(hand: HandObservation): FingersUp {
  const lm = hand.landmarks;
  if (lm.length < 21) {
    return { thumb: false, index: false, middle: false, ring: false, pinky: false };
  }
  return {
    thumb: thumbExtended(lm, hand.handedness),
    index: longFingerExtended(lm, "index"),
    middle: longFingerExtended(lm, "middle"),
    ring: longFingerExtended(lm, "ring"),
    pinky: longFingerExtended(lm, "pinky"),
  };
}

/** Nº de dedos extendidos, 0..5. */
export function fingerCount(f: FingersUp): number {
  return [f.thumb, f.index, f.middle, f.ring, f.pinky].filter(Boolean).length;
}

/**
 * Grado del acorde (1..7) que indica la mano, o `null` si no hay dedos
 * extendidos (mano cerrada / sin lectura fiable).
 */
export function readDegree(hand: HandObservation): number | null {
  const f = fingersUp(hand);
  const indexPinkyOnly = f.index && f.pinky && !f.middle && !f.ring;
  if (indexPinkyOnly && !f.thumb) return 6;
  if (indexPinkyOnly && f.thumb) return 7;
  const count = fingerCount(f);
  return count >= 1 && count <= 5 ? count : null;
}

// --- Mano derecha: voicing / extensión ------------------------------------

export type VoicingShape = "root" | "seventh" | "dominant" | "altered";

export interface VoicingIntent {
  /** Forma base según los dedos índice→meñique. */
  shape: VoicingShape;
  /** Pulgar extendido → primera inversión (combinable con cualquier `shape`). */
  inverted: boolean;
}

/**
 * `VoicingShape` → `Voicing` (1..6) de `musicTheory.ts`. Se ignora `inverted`
 * (la inversión no cambia la nomenclatura que se muestra; `HandTracker` la usará
 * para el voicing real cuando se conecte el audio).
 *   root → 1 · seventh → 3 · dominant → 4 · altered → 5
 */
export function voicingEnum(v: VoicingIntent | null): 1 | 3 | 4 | 5 {
  switch (v?.shape) {
    case "seventh":
      return 3;
    case "dominant":
      return 4;
    case "altered":
      return 5;
    default:
      return 1;
  }
}

/**
 * Voicing que indica la mano derecha, o `null` si no hay lectura fiable (sin
 * índice, o una combinación no contigua como índice+anular).
 *
 *   índice                              → fundamental
 *   índice + corazón                    → séptima
 *   índice + corazón + anular           → séptima dominante
 *   índice + corazón + anular + meñique → aumentado / disminuido
 *   + pulgar (en cualquiera de las de arriba) → primera inversión
 *
 * Nota: la 1ª inversión de "séptima dominante" y de "aum/dim" todavía no tiene
 * un `Voicing` propio en `musicTheory.ts` (hoy solo 2 y 6). Al cablear
 * `HandTracker` habrá que ampliar el enum o mapear al más cercano.
 */
export function readVoicing(hand: HandObservation): VoicingIntent | null {
  const f = fingersUp(hand);
  if (!f.index) return null;

  let shape: VoicingShape;
  if (f.middle && f.ring && f.pinky) shape = "altered";
  else if (f.middle && f.ring && !f.pinky) shape = "dominant";
  else if (f.middle && !f.ring && !f.pinky) shape = "seventh";
  else if (!f.middle && !f.ring && !f.pinky) shape = "root";
  else return null;

  return { shape, inverted: f.thumb };
}

// --- Inclinación de la mano → calidad (mayor / menor) ---------------------

/**
 * Inclinación lateral de la mano, −1..1, con zona muerta natural: la muñeca
 * (landmark 0) se compara con el tramo entre los nudillos de corazón y anular
 * (9 y 13); solo cuenta si la muñeca se proyecta fuera de ese tramo. Método de
 * la referencia de Eric Wei (`getHandHorizontalTilt`), sin el signo dependiente
 * de la mano.
 *
 * `> 0` = inclinada a la derecha del usuario (mano izquierda en el vídeo
 * espejado) → **mayor**; `< 0` = a la izquierda → **menor**.
 * (Verificado con webcam 2026-09-02, leyendo la mano izquierda.)
 */
export function handTilt(hand: HandObservation): number {
  const lm = hand.landmarks;
  if (lm.length < 21) return 0;
  const wristX = lm[0].x;
  const minX = Math.min(lm[9].x, lm[13].x);
  const maxX = Math.max(lm[9].x, lm[13].x);
  const MAX_TRAVEL = 0.12;
  let t = 0;
  if (wristX > maxX) t = (wristX - maxX) / MAX_TRAVEL;
  else if (wristX < minX) t = (wristX - minX) / MAX_TRAVEL;
  return Math.max(-1, Math.min(1, t));
}

export const TILT_THRESHOLD = 0.15;

/**
 * Calidad del acorde por la inclinación: **derecha → mayor, izquierda → menor**.
 * `null` si la mano está demasiado vertical (dentro de la zona muerta) — quien
 * llama decide el valor por defecto (la lectura en pantalla usa "major").
 */
export function readQuality(hand: HandObservation): "major" | "minor" | null {
  const t = handTilt(hand);
  if (t >= TILT_THRESHOLD) return "major";
  if (t <= -TILT_THRESHOLD) return "minor";
  return null;
}
