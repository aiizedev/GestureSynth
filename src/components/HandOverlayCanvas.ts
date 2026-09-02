/**
 * Overlay de cámara a pantalla completa — sin `@mediapipe/tasks-vision`, sin
 * `tone`. Inspirado en la referencia de Eric Wei: el vídeo llena la pantalla
 * (recorte tipo `object-fit: cover`), espejado, y encima —por estética— solo
 * los 21 nodos de cada mano como puntos blancos (sin líneas de esqueleto ni
 * etiquetas; la identificación Izq/Der vive en el HUD).
 * El canvas va en gris atenuado hasta que la cámara está activa.
 */
import type { HandsFrame } from "../tracking/handModel";

const BG = "#111";
const NODE_COLOR = "rgba(255, 255, 255, 0.72)";
const MAX_DPR = 2;

export class HandOverlayCanvas {
  readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    this.element = document.createElement("div");
    this.element.className = "hand-overlay";

    this.canvas = document.createElement("canvas");
    this.canvas.classList.add("dimmed");
    this.ctx = this.canvas.getContext("2d")!;

    this.element.append(this.canvas);
  }

  /** Quita/pone el filtro gris (cámara activa vs. en espera). */
  setDimmed(dimmed: boolean): void {
    this.canvas.classList.toggle("dimmed", dimmed);
  }

  render(video: HTMLVideoElement, frame: HandsFrame): void {
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const cw = Math.round(cssW * dpr);
    const ch = Math.round(cssH * dpr);
    if (this.canvas.width !== cw) this.canvas.width = cw;
    if (this.canvas.height !== ch) this.canvas.height = ch;

    const ctx = this.ctx;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, cw, ch);

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // Escala "cover": llena el canvas y recorta lo que sobra.
    const scale = vw > 0 && vh > 0 ? Math.max(cw / vw, ch / vh) : 1;
    const drawW = vw * scale;
    const drawH = vh * scale;
    const ox = (cw - drawW) / 2;
    const oy = (ch - drawH) / 2;

    ctx.save();
    ctx.translate(cw, 0);
    ctx.scale(-1, 1); // espejo horizontal
    if (vw > 0) ctx.drawImage(video, ox, oy, drawW, drawH);

    const r = Math.max(2, cw / 440);
    ctx.fillStyle = NODE_COLOR;
    ctx.shadowColor = "rgba(255, 255, 255, 0.3)";
    ctx.shadowBlur = r * 1.4;
    for (const hand of frame.hands) {
      for (const p of hand.landmarks) {
        ctx.beginPath();
        ctx.arc(ox + p.x * drawW, oy + p.y * drawH, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
