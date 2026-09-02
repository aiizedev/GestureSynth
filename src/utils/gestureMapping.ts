import type { Synth } from "../audio/Synth";
import type { KeyMode, Voicing } from "./musicTheory";
import { buildChord } from "./musicTheory";

/**
 * ÚNICA capa que conecta `tracking/` ↔ `audio/` (ver CLAUDE.md).
 *
 * `GestureState` es el contrato congelado: hoy lo produce el panel tipo DAW
 * (`tracking/PanelPerformanceSource.ts`); mañana lo producirá `HandTracker.ts`
 * a partir de landmarks de mano. `makeGestureApplier` NO cambia con ese swap.
 */

/** Intención de acorde: raíz como grado dentro de una tonalidad + alteraciones. */
export interface ChordIntent {
  /** Tónica de la tonalidad, p. ej. "C". */
  key: string;
  /** Modo de la tonalidad: 12 tonalidades mayores + 12 menores (escala natural). */
  keyMode: KeyMode;
  /** Grado de la escala de la tonalidad, 1..7 (I..VII) — es la raíz del acorde. */
  degree: number;
  quality: "major" | "minor";
  /** Voicing / extensión, 1..8 (ver `VOICING_LABELS`). */
  voicing: Voicing;
  /** Desplazamiento de octava, típicamente -1..+1. */
  octave: number;
}

export interface GestureState {
  chord: ChordIntent;
  /** Volumen de performance en dB (lo mueve el gesto / la mano derecha). */
  volumeDb: number;
  /** note on / note off (mantener pad pulsado; luego: gesto de pinza). */
  triggerActive: boolean;
}

function chordChanged(a: ChordIntent, b: ChordIntent): boolean {
  return (
    a.key !== b.key ||
    a.keyMode !== b.keyMode ||
    a.degree !== b.degree ||
    a.quality !== b.quality ||
    a.voicing !== b.voicing ||
    a.octave !== b.octave
  );
}

/**
 * Devuelve una función que recibe un `GestureState` y traduce los cambios a
 * llamadas de la API opaca de `Synth`. Mantiene el estado previo por dentro para
 * disparar `noteOn`/`noteOff` sólo en los flancos de `triggerActive`.
 */
export function makeGestureApplier(
  synth: Synth,
): (state: GestureState) => void {
  let prev: GestureState | null = null;

  return (state: GestureState) => {
    if (!prev || chordChanged(prev.chord, state.chord)) {
      synth.setChord(buildChord(state.chord));
    }
    if (!prev || prev.volumeDb !== state.volumeDb) {
      synth.setVolume(state.volumeDb);
    }
    if (state.triggerActive && !prev?.triggerActive) {
      synth.noteOn();
    } else if (!state.triggerActive && prev?.triggerActive) {
      synth.noteOff();
    }
    prev = state;
  };
}
