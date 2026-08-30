import type { TimbrePreset, Waveform } from "../audio/presets/types";

const W = 300;
const H = 150;

const OSC_TOP = 6;
const OSC_H = 38;
const DIVIDER_Y = 52;
const BOTTOM_TOP = 58;
const BOTTOM_H = 78;

const GAP = 12;
const FILTER_W = 168;
const ENV_W = W - FILTER_W - GAP;

const BG = "#0f1117";
const GRID = "#2a2f3d";
const AXIS = "#4a5064";
const OSC_LINE = "#e0b27e";
const FILTER_LINE = "#6ea8fe";
const ENV_LINE = "#7ee0c0";
const TEXT = "#99a0b3";

const F_MIN = 20;
const F_MAX = 20000;
const DB_TOP = 12;
const DB_BOTTOM = -36;

const TWO_PI = Math.PI * 2;

/** Un período (fase 0..1) de la onda pedida, en el rango -1..1. */
function periodic(type: Waveform, phase: number): number {
  const t = phase - Math.floor(phase);
  switch (type) {
    case "sine":
      return Math.sin(TWO_PI * t);
    case "triangle":
      return t < 0.5 ? 4 * t - 1 : 3 - 4 * t;
    case "sawtooth":
      return 2 * t - 1;
    case "square":
      return t < 0.5 ? 1 : -1;
  }
}

/**
 * Valor del oscilador en la fase `p`. En motor FM aplica modulación de fase
 * (`carrier + I·sin(ωm)`), así la vista también reacciona a Ratio / FM Amount.
 */
function oscValue(preset: TimbrePreset, p: number): number {
  if (preset.engine === "fm" && preset.fm) {
    const ph =
      p +
      ((preset.fm.modulationIndex * 0.1) *
        Math.sin(TWO_PI * p * preset.fm.harmonicity)) /
        TWO_PI;
    return periodic(preset.oscillator.waveform, ph);
  }
  return periodic(preset.oscillator.waveform, p);
}

/**
 * Visualizador del timbre. Dibuja, SÓLO a partir de los números del preset (sin
 * tocar audio): la forma de onda del oscilador (arriba), la respuesta del filtro
 * (abajo izq.) y la forma de la envolvente de amplitud (abajo der.).
 */
export class TimbreScope {
  readonly element: HTMLDivElement;
  private readonly ctx: CanvasRenderingContext2D | null;

  constructor() {
    this.element = document.createElement("div");
    this.element.className = "scope";

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext("2d");
    this.element.append(canvas);
  }

  render(preset: TimbrePreset): void {
    const ctx = this.ctx;
    if (!ctx) return; // sin contexto 2D (p. ej. entorno de test)
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    this.drawOscillator(ctx, preset);

    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, DIVIDER_Y);
    ctx.lineTo(W, DIVIDER_Y);
    ctx.stroke();

    ctx.save();
    ctx.translate(0, BOTTOM_TOP);
    this.drawFilter(ctx, preset);
    this.drawEnvelope(ctx, preset.ampEnv);
    ctx.restore();

    ctx.fillStyle = TEXT;
    ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(preset.engine === "fm" ? "osc (FM)" : "osc", 4, OSC_TOP + 8);
    ctx.fillText("filter", 4, H - 4);
    ctx.fillText("envelope", FILTER_W + GAP + 4, H - 4);
  }

  // --- Oscilador --------------------------------------------------------

  private drawOscillator(
    ctx: CanvasRenderingContext2D,
    preset: TimbrePreset,
  ): void {
    const midY = OSC_TOP + OSC_H / 2;
    const amp = OSC_H / 2 - 2;
    const cycles = 2.5;

    ctx.strokeStyle = AXIS;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(W, midY);
    ctx.stroke();

    // Copia tenue desafinada cuando hay unísono (motor sustractivo).
    if (preset.engine !== "fm" && preset.oscillator.unison > 0) {
      ctx.strokeStyle = "rgba(224,178,126,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x++) {
        const p = (x / W) * cycles;
        const drift = (x / W) * (preset.oscillator.spread / 50) * 0.6;
        const y = midY - oscValue(preset, p + drift) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = OSC_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x++) {
      const p = (x / W) * cycles;
      const y = midY - oscValue(preset, p) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // --- Filtro (origen ya trasladado a BOTTOM_TOP) ----------------------

  private drawFilter(
    ctx: CanvasRenderingContext2D,
    preset: TimbrePreset,
  ): void {
    const x0 = 0;
    const w = FILTER_W;
    const h = BOTTOM_H;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, w, h);
    ctx.clip();

    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (const f of [100, 1000, 10000]) {
      const x = x0 + this.freqX(f) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.strokeStyle = AXIS;
    const yZero = this.dbY(0) * h;
    ctx.beginPath();
    ctx.moveTo(x0, yZero);
    ctx.lineTo(x0 + w, yZero);
    ctx.stroke();

    if (preset.engine === "fm") {
      ctx.fillStyle = TEXT;
      ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("FM engine — no filter", x0 + 10, h / 2);
      ctx.restore();
      return;
    }

    ctx.strokeStyle = FILTER_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px <= w; px += 2) {
      const f = F_MIN * Math.pow(F_MAX / F_MIN, px / w);
      const db = this.filterMagnitudeDb(
        f,
        preset.filter.cutoff,
        preset.filter.resonance,
        preset.filter.rolloff,
      );
      const y = this.dbY(db) * h;
      if (px === 0) ctx.moveTo(x0 + px, y);
      else ctx.lineTo(x0 + px, y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(110,168,254,0.35)";
    ctx.lineWidth = 1;
    const xc = x0 + this.freqX(preset.filter.cutoff) * w;
    ctx.beginPath();
    ctx.moveTo(xc, 0);
    ctx.lineTo(xc, h);
    ctx.stroke();

    ctx.restore();
  }

  private freqX(f: number): number {
    return Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN);
  }

  private dbY(db: number): number {
    return (DB_TOP - db) / (DB_TOP - DB_BOTTOM);
  }

  private filterMagnitudeDb(
    f: number,
    cutoff: number,
    resonance: number,
    rolloff: number,
  ): number {
    const oct = Math.log2(f / cutoff);
    const peak = resonance * 1.6;
    const bump = peak * Math.exp(-(oct * oct) / (2 * 0.18 * 0.18));
    const atten = oct > 0 ? rolloff * oct : 0;
    return Math.max(DB_BOTTOM, Math.min(DB_TOP, bump + atten));
  }

  // --- Envolvente (origen ya trasladado a BOTTOM_TOP) ----------------

  private drawEnvelope(
    ctx: CanvasRenderingContext2D,
    env: TimbrePreset["ampEnv"],
  ): void {
    const x0 = FILTER_W + GAP;
    const w = ENV_W;
    const h = BOTTOM_H;
    const hold = 0.35;
    const total = env.attack + env.decay + hold + env.release || 1;
    const tx = (t: number) => x0 + (t / total) * w;
    const ly = (level: number) => h - level * (h - 2) - 1;

    ctx.strokeStyle = AXIS;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, h);
    ctx.lineTo(x0 + w, h);
    ctx.stroke();

    ctx.strokeStyle = ENV_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx(0), ly(0));
    ctx.lineTo(tx(env.attack), ly(1));
    ctx.lineTo(tx(env.attack + env.decay), ly(env.sustain));
    ctx.lineTo(tx(env.attack + env.decay + hold), ly(env.sustain));
    ctx.lineTo(tx(total), ly(0));
    ctx.stroke();
  }
}
