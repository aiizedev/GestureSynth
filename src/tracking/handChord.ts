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
 * mayor). Derecha: dedos → forma del acorde (voicing), pulgar → 1ª inversión.
 *
 * El acorde SÓLO se toca si las DOS manos dan una lectura válida: la izquierda un
 * grado y la derecha un voicing (índice arriba en una combinación contigua). Sólo
 * con la izquierda no suena — hay que especificar el voicing con la derecha.
 * `null` si falta cualquiera de las dos lecturas.
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

  const rv = right ? readVoicing(right) : null;
  if (!rv) return null;

  const quality = readQuality(left) ?? "major";
  const voicing: Voicing = rv.inverted ? INVERTED[rv.shape] : voicingEnum(rv);

  return { key, keyMode, degree, quality, voicing, octave: 0 };
}
