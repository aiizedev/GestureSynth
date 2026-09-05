/**
 * Mano derecha → dinámica de interpretación (volumen + drive expresivo). PURO:
 * sin DOM, sin `@mediapipe/tasks-vision`, sin `tone`.
 *
 * La `y` de MediaPipe crece hacia ABAJO (0 = borde superior del frame), así que
 * la "altura" de la mano es `1 - y`. Se lee de la muñeca (landmark 0), igual que
 * `handTilt` en `handPose.ts`.
 *
 *   - A la altura NEUTRA (`NEUTRAL_HEIGHT`, la mano cómoda a media pantalla) el
 *     volumen de performance es **0 dB = unity**: el preset suena EXACTO a como
 *     se diseñó (mismo nivel que su `master`). Por debajo atenúa hasta
 *     `VOLUME_MIN_DB`; por encima realza hasta `VOLUME_MAX_DB`, tope que se
 *     alcanza ya en `FULL_BOOST_HEIGHT` (no hace falta llegar al borde).
 *   - Pasado `DRIVE_THRESHOLD` empieza a entrar distorsión, hasta `DRIVE_MAX` en
 *     `DRIVE_FULL_HEIGHT`. Ese drive se SUMA al del preset en `Synth`, no lo pisa.
 */
import type { HandObservation } from "./handModel";

export interface Dynamics {
  /** Volumen de performance en dB (0 = unity = el preset tal cual se diseñó). */
  volumeDb: number;
  /** Drive/distorsión expresiva 0..1 (se suma al `drive` del preset). */
  drive: number;
}

/** Altura (0..1) a la que el volumen de performance es 0 dB (suena "de diseño"). */
export const NEUTRAL_HEIGHT = 0.5;
/**
 * Altura a la que ya se alcanza el realce máximo. Bien por debajo del borde: el
 * usuario casi tenía que sacar la mano del cuadro para llegar al volumen máximo.
 */
export const FULL_BOOST_HEIGHT = 0.75;
/** dB con la mano en el suelo del cuadro / en `FULL_BOOST_HEIGHT` o más. */
export const VOLUME_MIN_DB = -18;
export const VOLUME_MAX_DB = 6;
/**
 * Altura normalizada a partir de la cual entra la distorsión, y a la que satura.
 * El umbral está algo por encima del punto neutro (0.5): al empujar la mano por
 * encima del nivel "de diseño" el sonido empieza a ensuciarse.
 */
export const DRIVE_THRESHOLD = 0.6;
export const DRIVE_FULL_HEIGHT = 0.8;
/** Drive expresivo máximo. */
export const DRIVE_MAX = 0.3;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Altura de la mano dentro del cuadro, 0 (abajo) .. 1 (arriba). */
export function handHeight(hand: HandObservation): number {
  const wristY = hand.landmarks[0]?.y ?? 0.5;
  return clamp01(1 - wristY);
}

/** Dinámica (volumen + drive) para una altura de mano 0..1. */
export function dynamicsFromHeight(height: number): Dynamics {
  const h = clamp01(height);

  let volumeDb: number;
  if (h <= NEUTRAL_HEIGHT) {
    // Suelo → neutro: VOLUME_MIN_DB .. 0 dB.
    const t = NEUTRAL_HEIGHT <= 0 ? 1 : h / NEUTRAL_HEIGHT;
    volumeDb = VOLUME_MIN_DB * (1 - t);
  } else {
    // Neutro → FULL_BOOST_HEIGHT: 0 .. VOLUME_MAX_DB (se satura pasado ese punto).
    const t = clamp01((h - NEUTRAL_HEIGHT) / (FULL_BOOST_HEIGHT - NEUTRAL_HEIGHT));
    volumeDb = VOLUME_MAX_DB * t;
  }

  const over = clamp01(
    (h - DRIVE_THRESHOLD) / (DRIVE_FULL_HEIGHT - DRIVE_THRESHOLD),
  );
  const drive = over <= 0 ? 0 : Math.round(DRIVE_MAX * over * 50) / 50;

  const vol = Math.round(volumeDb * 2) / 2;
  return { volumeDb: vol === 0 ? 0 : vol, drive };
}

/**
 * Dinámica que indica la mano derecha, o `null` si no hay mano derecha (quien
 * llama decide: en `/gesture` se mantiene la última).
 */
export function readDynamics(right: HandObservation | undefined): Dynamics | null {
  return right ? dynamicsFromHeight(handHeight(right)) : null;
}
