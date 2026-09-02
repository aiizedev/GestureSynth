/**
 * Estabiliza el `ChordIntent` crudo que sale de las manos (una lectura por frame
 * de detección, ~20 fps) antes de mandarlo al `Synth`. PURO: sin DOM, sin tone,
 * sin `@mediapipe/tasks-vision` — determinista dada la secuencia de llamadas.
 *
 * Resuelve dos problemas de la lectura directa que hacían sonar el instrumento
 * "sucio":
 *  - **Acordes fantasma en las transiciones**: al pasar de 2 a 5 dedos la mano
 *    cruza por 3 y 4; sin filtro esos grados intermedios suenan. Un intent nuevo
 *    solo se confirma tras repetirse `holdFrames` frames seguidos.
 *  - **Retrigger por parpadeo**: un frame suelto sin lectura fiable (puño
 *    momentáneo, un dedo que baja al cambiar de forma) apagaba y volvía a
 *    disparar el acorde. El trigger ahora exige `attackFrames` frames con mano
 *    para activarse y `releaseFrames` sin mano para soltarse (histéresis).
 *
 * El primer acorde se confirma sin latencia; a partir de ahí el último acorde
 * confirmado se mantiene aunque se pierda la mano (igual que hacía el `lastChord`
 * de `gesture.ts`, que este módulo sustituye).
 */
import type { ChordIntent } from "../utils/gestureMapping";

export interface ChordStabilizerOptions {
  /** Frames seguidos con el mismo intent nuevo para confirmarlo. Def. 3 (~150 ms a 20 fps). */
  holdFrames?: number;
  /** Frames seguidos con mano para activar el trigger. Def. 2. */
  attackFrames?: number;
  /** Frames seguidos sin lectura fiable para soltar el trigger. Def. 3. */
  releaseFrames?: number;
}

export interface StableChord {
  /** Último acorde confirmado (se mantiene aunque se pierda la mano). */
  chord: ChordIntent;
  /** note on / note off ya con histéresis. */
  triggerActive: boolean;
}

function sameChord(a: ChordIntent, b: ChordIntent): boolean {
  return (
    a.key === b.key &&
    a.keyMode === b.keyMode &&
    a.degree === b.degree &&
    a.quality === b.quality &&
    a.voicing === b.voicing &&
    a.octave === b.octave
  );
}

/**
 * Devuelve una función que recibe la lectura cruda de cada frame
 * (`ChordIntent | null`, `null` = sin mano izquierda fiable) y devuelve el estado
 * estable, o `null` mientras no se haya confirmado ningún acorde todavía.
 */
export function makeChordStabilizer(
  opts: ChordStabilizerOptions = {},
): (raw: ChordIntent | null) => StableChord | null {
  const holdFrames = Math.max(1, opts.holdFrames ?? 3);
  const attackFrames = Math.max(1, opts.attackFrames ?? 2);
  const releaseFrames = Math.max(1, opts.releaseFrames ?? 3);

  let committed: ChordIntent | null = null;
  let candidate: ChordIntent | null = null;
  let candidateHits = 0;
  let present = 0;
  let absent = 0;
  let triggerActive = false;

  return (raw) => {
    if (raw) {
      present++;
      absent = 0;
      if (present >= attackFrames) triggerActive = true;

      if (!committed) {
        // Primer acorde: sin latencia, se confirma en cuanto se lee.
        committed = raw;
        candidate = raw;
        candidateHits = holdFrames;
      } else if (sameChord(raw, committed)) {
        candidate = committed;
        candidateHits = holdFrames;
      } else if (candidate && sameChord(raw, candidate)) {
        candidateHits++;
        if (candidateHits >= holdFrames) committed = candidate;
      } else {
        candidate = raw;
        candidateHits = 1;
      }
    } else {
      present = 0;
      absent++;
      // Un intent a medio confirmar se descarta si la mano desaparece.
      candidate = committed;
      candidateHits = committed ? holdFrames : 0;
      if (absent >= releaseFrames) triggerActive = false;
    }

    return committed ? { chord: committed, triggerActive } : null;
  };
}
