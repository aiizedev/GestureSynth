import "./style.css";
import { Synth } from "./audio/Synth";
import { CameraFeed } from "./tracking/CameraFeed";
import { HandLandmarkerSource } from "./tracking/HandLandmarker";
import { GestureView } from "./components/GestureView";
import { PresetSelector } from "./components/PresetSelector";
import { makeGestureApplier } from "./utils/gestureMapping";
import { makeChordStabilizer } from "./tracking/chordStabilizer";

/**
 * Entry de `/gesture` (fase 2): cámara → `HandLandmarkerSource` → `GestureView`,
 * y el acorde que leen las manos → `Synth` (a través de `makeGestureApplier`,
 * el mismo puente que usa el panel DAW por mouse).
 *
 * El render del vídeo va a ~60 fps (fluido); la detección de manos va limitada a
 * `DETECT_FPS` para no saturar la CPU/GPU.
 */
const DETECT_FPS = 20;
const MIN_INTERVAL_MS = 1000 / DETECT_FPS;
const PERFORMANCE_VOLUME_DB = -6;

const app = document.querySelector<HTMLDivElement>("#gesture-app")!;

const camera = new CameraFeed();
const tracker = new HandLandmarkerSource();
const synth = new Synth();
const applyGesture = makeGestureApplier(synth);

const presets = new PresetSelector({
  onChange: (preset) => synth.setTimbre(preset),
});

// Filtro temporal entre la lectura cruda de las manos y el `Synth`: confirma un
// acorde nuevo solo tras varios frames iguales (mata los grados intermedios de
// una transición) y da histéresis al note on/off (un frame suelto sin mano no
// re-dispara). Mantiene el último acorde confirmado cuando se pierde la mano.
const stabilize = makeChordStabilizer();

const view = new GestureView({
  leftControls: [presets.element],
  onActivate: async () => {
    await Promise.all([camera.start(), tracker.init(), synth.start()]);
    synth.setTimbre(presets.current);
    startLoop();
  },
  onChord: (chord) => {
    const stable = stabilize(chord);
    if (!stable) return;
    applyGesture({
      chord: stable.chord,
      volumeDb: PERFORMANCE_VOLUME_DB,
      triggerActive: stable.triggerActive,
    });
  },
});

app.append(view.element);

let running = false;
let lastDetect = 0;
let lastVideoTime = -1;

function startLoop(): void {
  if (running) return;
  running = true;

  const tick = (now: number) => {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!camera.ready) return;

    const due = now - lastDetect >= MIN_INTERVAL_MS;
    const fresh = camera.video.currentTime !== lastVideoTime;

    if (tracker.ready && due && fresh) {
      lastDetect = now;
      lastVideoTime = camera.video.currentTime;
      view.update(camera.video, tracker.detect(camera.video, now));
    } else {
      // Frame intermedio: repinta el vídeo para que se vea fluido.
      view.paint(camera.video);
    }
  };
  requestAnimationFrame(tick);
}

window.addEventListener("beforeunload", () => {
  running = false;
  tracker.dispose();
  camera.stop();
});
