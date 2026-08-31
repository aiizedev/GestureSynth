import type { ChordIntent, GestureState } from "../utils/gestureMapping";

type Listener = (state: GestureState) => void;

const DEFAULT_STATE: GestureState = {
  chord: {
    key: "C",
    keyMode: "major",
    degree: 1,
    quality: "major",
    voicing: 1,
    octave: 0,
  },
  volumeDb: -6,
  triggerActive: false,
};

/**
 * Fuente de `GestureState` TEMPORAL, movida por el panel tipo DAW (mouse).
 *
 * Expone la MISMA interfaz que tendrá `tracking/HandTracker.ts`
 * (`subscribe` / `dispose`), de modo que el día que entre MediaPipe se cambia
 * la instancia en `main.ts` y nada más: ni `gestureMapping.ts` ni `Synth.ts`.
 */
export class PanelPerformanceSource {
  private state: GestureState = structuredClone(DEFAULT_STATE);
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
  }

  getState(): GestureState {
    return this.snapshot();
  }

  // --- Mutadores que llama la UI -------------------------------------------

  setChordConfig(partial: Partial<ChordIntent>): void {
    this.state.chord = { ...this.state.chord, ...partial };
    this.emit();
  }

  /**
   * Pad mantenido pulsado: fija grado + calidad y activa el trigger.
   * Cada pad lleva su propia calidad, así se pueden combinar acordes mayores y
   * menores de cualquier grado (dominantes secundarias, préstamos tonales…).
   */
  pressPad(degree: number, quality: ChordIntent["quality"]): void {
    this.state.chord = { ...this.state.chord, degree, quality };
    this.state.triggerActive = true;
    this.emit();
  }

  releasePad(): void {
    this.state.triggerActive = false;
    this.emit();
  }

  setVolumeDb(db: number): void {
    this.state.volumeDb = db;
    this.emit();
  }

  // --- Interno -----------------------------------------------------------

  private snapshot(): GestureState {
    return structuredClone(this.state);
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }
}
