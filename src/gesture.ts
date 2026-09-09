import "./style.css";
import { Synth } from "./audio/Synth";
import { CameraFeed } from "./tracking/CameraFeed";
import { HandLandmarkerSource } from "./tracking/HandLandmarker";
import { GestureView } from "./components/GestureView";
import { PresetSelector } from "./components/PresetSelector";
import { AccountButton } from "./components/AccountButton";
import { initPresetSync } from "./auth/presetSync";
import { makeGestureApplier } from "./utils/gestureMapping";
import { makeChordStabilizer } from "./tracking/chordStabilizer";
import {
  dynamicsFromHeight,
  NEUTRAL_HEIGHT,
  type Dynamics,
} from "./tracking/handDynamics";

/**
 * Entry de `/gesture` (fase 2): cámara → `HandLandmarkerSource` → `GestureView`,
 * y lo que leen las manos → `Synth` (a través de `makeGestureApplier`, el mismo
 * puente que usa el panel DAW por mouse):
 *   - mano IZQUIERDA → acorde (grado + calidad) y mano DERECHA → voicing;
 *   - altura de la mano DERECHA → volumen, y por encima del 70 % → distorsión.
 *
 * El render del vídeo va a ~60 fps (fluido); la detección de manos va limitada a
 * `DETECT_FPS` para no saturar la CPU/GPU.
 */
const DETECT_FPS = 20;
const MIN_INTERVAL_MS = 1000 / DETECT_FPS;

const app = document.querySelector<HTMLDivElement>("#gesture-app")!;

const camera = new CameraFeed();
const tracker = new HandLandmarkerSource();
const synth = new Synth();
const applyGesture = makeGestureApplier(synth);

const presets = new PresetSelector({
  onChange: (preset) => synth.setTimbre(preset),
});

// Cuenta (opcional): misma sesión que en `/`, para guardar presets en la nube.
const account = new AccountButton("compact");

// Con sesión, sincroniza los presets de usuario con la nube (sin sesión, no-op).
initPresetSync();

// Filtro temporal entre la lectura cruda de las manos y el `Synth`: confirma un
// acorde nuevo solo tras varios frames iguales (mata los grados intermedios de
// una transición) y da histéresis al note on/off (un frame suelto sin mano no
// re-dispara). Mantiene el último acorde confirmado cuando se pierde la mano.
const stabilize = makeChordStabilizer();

// Última dinámica válida: se mantiene cuando la mano derecha sale de cuadro para
// que el volumen no pegue un salto. Arranca en la altura neutra → 0 dB (el
// preset suena tal cual se diseñó hasta que la mano derecha diga otra cosa).
let lastDynamics: Dynamics = dynamicsFromHeight(NEUTRAL_HEIGHT);

const view = new GestureView({
  leftControls: [presets.element],
  // La foto de perfil va en la última fila, junto a "crear sonidos".
  footAside: account.element,
  getSound: () => synth.getCurrentTimbre(),
  // Importar desde el menú ⚙: el popup pide nombre; se guarda como preset de
  // usuario, aparece en el dropdown seleccionado y suena, sin recargar.
  onImport: (preset, name) => presets.applyImported(preset, name),
  onActivate: async () => {
    await Promise.all([camera.start(), tracker.init(), synth.start()]);
    synth.setTimbre(presets.current);
    startLoop();
  },
  onPerform: ({ chord, rightHeight }) => {
    const stable = stabilize(chord);
    if (!stable) return;
    if (rightHeight !== null) lastDynamics = dynamicsFromHeight(rightHeight);
    applyGesture({
      chord: stable.chord,
      volumeDb: lastDynamics.volumeDb,
      drive: lastDynamics.drive,
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

    // Aura audio-reactiva: cada frame, siga o no la detección.
    view.setLevel(synth.getLevel());
  };
  requestAnimationFrame(tick);
}

window.addEventListener("beforeunload", () => {
  running = false;
  tracker.dispose();
  camera.stop();
  account.dispose();
});
