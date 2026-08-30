import type { PanelPerformanceSource } from "../tracking/PanelPerformanceSource";
import type { GestureState } from "../utils/gestureMapping";
import { buildChord, describeChord } from "../utils/musicTheory";

/**
 * HUD de referencia visual: acorde activo, sus notas y si el trigger está sonando.
 * Sólo lee el `GestureState` — no toca audio.
 */
export class ChordHud {
  readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly chordEl: HTMLDivElement;
  private readonly notesEl: HTMLDivElement;
  private readonly triggerEl: HTMLDivElement;
  private readonly unsubscribe: () => void;

  constructor(source: PanelPerformanceSource) {
    this.element = document.createElement("div");
    this.element.className = "hud";

    this.canvas = document.createElement("canvas");
    this.canvas.width = 220;
    this.canvas.height = 72;
    this.ctx = this.canvas.getContext("2d")!;

    const text = document.createElement("div");
    text.className = "hud-text";
    this.chordEl = document.createElement("div");
    this.chordEl.className = "hud-chord";
    this.notesEl = document.createElement("div");
    this.notesEl.className = "hud-notes";
    this.triggerEl = document.createElement("div");
    this.triggerEl.className = "hud-trigger";
    text.append(this.chordEl, this.notesEl, this.triggerEl);

    this.element.append(this.canvas, text);

    this.unsubscribe = source.subscribe((state) => this.render(state));
  }

  dispose(): void {
    this.unsubscribe();
  }

  private render(state: GestureState): void {
    const info = describeChord(state.chord);
    const freqs = buildChord(state.chord);

    this.chordEl.textContent = info.label;
    this.notesEl.textContent = info.notes.join("  ·  ");
    this.triggerEl.textContent = state.triggerActive
      ? "● sonando"
      : "○ en silencio";
    this.triggerEl.dataset.on = String(state.triggerActive);

    const { width, height } = this.canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, width, height);

    // Notas del acorde como puntos en un eje logarítmico de frecuencia.
    const min = Math.log2(110);
    const max = Math.log2(1760);
    freqs.forEach((f) => {
      const t = (Math.log2(f) - min) / (max - min);
      const x = 10 + t * (width - 20);
      ctx.beginPath();
      ctx.arc(x, height / 2, state.triggerActive ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = state.triggerActive ? "#7ee0c0" : "#4a5064";
      ctx.fill();
    });
  }
}
