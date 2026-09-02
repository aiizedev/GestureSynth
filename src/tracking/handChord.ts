/**
 * Las dos manos → `ChordIntent`. PURO: sin DOM, sin `@mediapipe/tasks-vision`,
 * sin `tone`.
 *
 * Es la pieza que `/gesture` usa para la lectura en pantalla y para hacer sonar
 * el `Synth` (vía `makeGestureApplier`), y la base de lo que hará `HandTracker`.
 */
import type { ChordIntent } from "../utils/gestureMapping";
import type { KeyMode, Voicing } from "../utils/musicTheory";
import type { HandObservation } from "./handModel";
import {
  readDegree,
  readQuality,
  readVoicing,
  voicingEnum,
  type VoicingShape,
} from "./handPose";

/** Voicing invertido (5ª al bajo) por forma — el pulgar activa la inversión. */
const INVERTED: Record<VoicingShape, Voicing> = {
  root: 2,
  seventh: 6,
  dominant: 7,
  altered: 8,
};

/**
 * Izquierda: dedos → grado, inclinación → calidad (mayor/menor; vertical →
 * mayor). Derecha: dedos → forma del acorde, pulgar → 1ª inversión.
 * `null` si falta la mano izquierda o su lectura no es fiable (puño cerrado).
 */
export function readChordIntent(
  left: HandObservation | undefined,
  right: HandObservation | undefined,
  key: string,
  keyMode: KeyMode,
): ChordIntent | null {
  if (!left) return null;
  const degree = readDegree(left);
  if (degree === null) return null;

  const quality = readQuality(left) ?? "major";
  const rv = right ? readVoicing(right) : null;
  const voicing: Voicing = rv?.inverted ? INVERTED[rv.shape] : voicingEnum(rv);

  return { key, keyMode, degree, quality, voicing, octave: 0 };
}
