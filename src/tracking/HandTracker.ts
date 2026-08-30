/**
 * STUB — todavía no implementado.
 *
 * TODO (roadmap CLAUDE.md pasos 1–4): MediaPipe Hand Landmarker
 * (`@mediapipe/tasks-vision`). 21 landmarks 3D + handedness por mano.
 *
 * Cuando exista, `HandTracker` producirá exactamente el mismo `GestureState`
 * que hoy emite `PanelPerformanceSource`, con la misma interfaz:
 *
 *   subscribe(listener: (state: GestureState) => void): () => void
 *   dispose(): void
 *
 * Correcciones que van AQUÍ o en `gestureMapping.ts` (nunca duplicadas):
 *  - handedness invertida por el espejo de la cámara.
 *  - suavizado de landmarks (EMA / One Euro Filter).
 *  - histéresis del gesto de pinza (landmark 4 ↔ 8) para note on/off.
 */
export {};
