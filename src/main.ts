import "./style.css";
import anime from "animejs";
import { Synth } from "./audio/Synth";
import { PanelPerformanceSource } from "./tracking/PanelPerformanceSource";
import { makeGestureApplier } from "./utils/gestureMapping";
import { TransportBar } from "./components/TransportBar";
import { ChordDeck } from "./components/ChordDeck";
import { TimbrePanel } from "./components/TimbrePanel";
import { ChordHud } from "./components/ChordHud";
import { ThemePicker } from "./components/ThemePicker";

const app = document.querySelector<HTMLDivElement>("#app")!;

// --- Audio + fuente de performance ------------------------------------------
const synth = new Synth();
const source = new PanelPerformanceSource();

// La ÚNICA pieza que puentea tracking ↔ audio. No cambia al conectar la cámara.
source.subscribe(makeGestureApplier(synth));

// --- Cabecera -------------------------------------------------------------
const header = document.createElement("header");
header.className = "site-head";

const title = document.createElement("h1");
title.className = "site-title";
title.append("Estación", document.createElement("br"), "de sonido");

const headActions = document.createElement("div");
headActions.className = "head-actions";
const letsPlay = document.createElement("a");
letsPlay.className = "lets-play";
letsPlay.href = "/gesture";
letsPlay.textContent = "Let's play →";
const brandTag = document.createElement("span");
brandTag.className = "brand-tag";
brandTag.textContent = "GestureSynth · sintetizador de acordes";
// El `<canvas>` del visualizador no reacciona solo a `--accent`: al cambiar de
// tema (aquí o desde otra pestaña con `/gesture`) hay que repintarlo.
const themePicker = new ThemePicker(() => timbrePanel.refreshVisuals());
headActions.append(letsPlay, brandTag, themePicker.element);

header.append(title, headActions);

// --- UI --------------------------------------------------------------------
const chordDeck = new ChordDeck(source);
const timbrePanel = new TimbrePanel(synth);
const hud = new ChordHud(source);

const transport = new TransportBar({
  onStart: async () => {
    await synth.start();
    chordDeck.setEnabled(true);
    timbrePanel.setEnabled(true);
    advanced?.setAttribute("aria-disabled", "false");
    document.documentElement.classList.add("audio-on");
    // Bloom de arranque en el botón (anime.js). Puro adorno: si no corre, no rompe.
    const startBtn = transport.element.querySelector<HTMLElement>(".start-btn");
    if (startBtn) {
      anime({
        targets: startBtn,
        scale: [1, 1.04, 1],
        duration: 620,
        easing: "easeOutElastic(1, 0.6)",
      });
    }
    runReactiveLoop();
  },
  onVolume: (db) => synth.setVolume(db),
});

const columns = document.createElement("div");
columns.className = "columns";
columns.append(chordDeck.element, timbrePanel.element);

// El bloque "Advanced" del timbre se saca de la columna y se coloca a todo el
// ancho, como fila propia entre las columnas y el HUD (fidelidad al diseño).
const advanced = timbrePanel.element.querySelector<HTMLElement>(".advanced");
advanced?.classList.add("advanced-row");
advanced?.setAttribute("aria-disabled", "true");

app.append(
  header,
  transport.element,
  columns,
  ...(advanced ? [advanced] : []),
  hud.element,
);
// La entrada escalonada de los bloques la hace CSS (`@keyframes rise`), que
// corre siempre, también con la pestaña en segundo plano.

// --- Bucle reactivo al sonido -------------------------------------------
// El nivel de salida del Synth alimenta el medidor y `--level` (0..1), que la
// CSS usa para el medidor de barras y la línea de acento bajo la cabecera.
function runReactiveLoop(): void {
  const root = document.documentElement;
  let smoothed = 0;
  const tick = () => {
    const raw = synth.getLevel();
    const safe = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
    smoothed += (safe - smoothed) * 0.18;
    transport.setMeterLevel(smoothed);
    root.style.setProperty("--level", smoothed.toFixed(3));
    requestAnimationFrame(tick);
  };
  tick();
}
