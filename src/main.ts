import "./style.css";
import { Synth } from "./audio/Synth";
import { PanelPerformanceSource } from "./tracking/PanelPerformanceSource";
import { makeGestureApplier } from "./utils/gestureMapping";
import { TransportBar } from "./components/TransportBar";
import { ChordDeck } from "./components/ChordDeck";
import { TimbrePanel } from "./components/TimbrePanel";
import { ChordHud } from "./components/ChordHud";

const app = document.querySelector<HTMLDivElement>("#app")!;

// --- Audio + fuente de performance ------------------------------------------
const synth = new Synth();
const source = new PanelPerformanceSource();

// La ÚNICA pieza que puentea tracking ↔ audio. No cambia al conectar la cámara.
source.subscribe(makeGestureApplier(synth));

// --- UI --------------------------------------------------------------------
const header = document.createElement("div");
header.innerHTML = `
  <h1>GestureSynth · módulo de audio</h1>
  <p class="subtitle">
    Sintetizador de acordes estilo DAW (control por mouse). Sin cámara todavía:
    valida el motor Tone.js, los presets y el contrato <code>GestureState</code>.
  </p>
`;

const chordDeck = new ChordDeck(source);
const timbrePanel = new TimbrePanel(synth);
const hud = new ChordHud(source);

const transport = new TransportBar({
  onStart: async () => {
    await synth.start();
    chordDeck.setEnabled(true);
    timbrePanel.setEnabled(true);
    runMeterLoop();
  },
  onVolume: (db) => synth.setVolume(db),
});

const columns = document.createElement("div");
columns.className = "columns";
columns.append(chordDeck.element, timbrePanel.element);

app.append(header, transport.element, columns, hud.element);

// --- Medidor de nivel ----------------------------------------------------
function runMeterLoop(): void {
  const tick = () => {
    transport.setMeterLevel(synth.getLevel());
    requestAnimationFrame(tick);
  };
  tick();
}
