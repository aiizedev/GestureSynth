/**
 * STUB — todavía no implementado como fuente formal de `GestureState`.
 *
 * Las piezas ya existen y `/gesture` ya suena:
 *  - `tracking/HandLandmarker.ts` → 21 landmarks + lado por mano (`HandsFrame`).
 *  - `tracking/handChord.ts` (`readChordIntent`) → `ChordIntent` de las dos manos.
 *  - `src/gesture.ts` cablea eso a `makeGestureApplier(synth)` en su bucle rAF.
 *
 * `HandTracker` sería el envoltorio con la MISMA interfaz que
 * `PanelPerformanceSource` (`subscribe(cb: (GestureState) => void)` / `dispose()`)
 * para poder cambiar la instancia en `main.ts` y correr el instrumento entero
 * por cámara. Le falta encapsular: ciclo de vida de cámara/modelo, `volumeDb`
 * (altura de la mano) y el trigger de note on/off (gesto de pinza con
 * histéresis, hoy es simplemente "hay mano izquierda con grado legible").
 */
export {};
