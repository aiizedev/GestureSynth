import type { TimbrePreset, Waveform } from "../audio/presets/types";

const W = 560;
const H = 128;

const MID = H / 2;
const AMP = H / 2 - 16;
const CYCLES = 4;

const TWO_PI = Math.PI * 2;

/**
 * Colores del visualizador leídos del tema en vivo (`:root`), así el scope
 * cambia de acento con `ThemePicker` sin recargar. Con fallbacks para tests /
 * entornos sin CSS.
 */
function readVar(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

interface ScopePalette {
  bg: string;
  grid: string;
  osc: string;
  line: string;
  text: string;
}

function palette(): ScopePalette {
  return {
    bg: readVar("--panel-2", "#131418"),
    grid: readVar("--rule", "#35363c"),
    osc: readVar("--text", "#e8e6df"),
    line: readVar("--accent", "#f3c69b"),
    text: readVar("--muted", "#8a8b91"),
  };
}

const SCOPE_FONT = '10px "Spline Sans Mono", ui-monospace, monospace';

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

/** Valor del oscilador en la fase `p` (con modulación de fase si el motor es FM). */
function oscValue(preset: TimbrePreset, p: number): number {
  if (preset.engine === "fm" && preset.fm) {
    const ph =
      p +
      (preset.fm.modulationIndex * 0.1 *
        Math.sin(TWO_PI * p * preset.fm.harmonicity)) /
        TWO_PI;
    return periodic(preset.oscillator.waveform, ph);
  }
  return periodic(preset.oscillator.waveform, p);
}

/** Nivel de amplitud 0..1 de la envolvente en el tiempo normalizado `u` (0..1). */
function ampAt(env: TimbrePreset["ampEnv"], u: number): number {
  const hold = 0.4;
  const total = env.attack + env.decay + hold + env.release || 1;
  const t = u * total;
  if (t < env.attack) return env.attack > 1e-3 ? t / env.attack : 1;
  if (t < env.attack + env.decay) {
    const k = env.decay > 1e-3 ? (t - env.attack) / env.decay : 1;
    return 1 - (1 - env.sustain) * k;
  }
  if (t < env.attack + env.decay + hold) return env.sustain;
  const k =
    env.release > 1e-3
      ? (t - env.attack - env.decay - hold) / env.release
      : 1;
  return env.sustain * (1 - Math.min(1, k));
}

/**
 * Visualizador del timbre: UNA onda continua que recorre el ancho y se
 * transforma por zonas — oscilador crudo (izq.) → suavizado por el filtro
 * (centro) → conformado por la envolvente de amplitud (der.). Dibuja SÓLO a
 * partir de los números del preset (sin tocar audio).
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
    const p = palette();

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);

    // Línea media + divisores de zona.
    ctx.strokeStyle = p.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, MID);
    ctx.lineTo(W, MID);
    ctx.moveTo(W / 3, 0);
    ctx.lineTo(W / 3, H);
    ctx.moveTo((2 * W) / 3, 0);
    ctx.lineTo((2 * W) / 3, H);
    ctx.stroke();

    this.drawWave(ctx, preset, p);

    ctx.fillStyle = p.text;
    ctx.font = SCOPE_FONT;
    ctx.textAlign = "center";
    ctx.fillText(preset.engine === "fm" ? "OSC · FM" : "OSC", W / 6, H - 8);
    ctx.fillText("FILTER", W / 2, H - 8);
    ctx.fillText("ENVELOPE", (5 * W) / 6, H - 8);
    ctx.textAlign = "left";
  }

  private drawWave(
    ctx: CanvasRenderingContext2D,
    preset: TimbrePreset,
    p: ScopePalette,
  ): void {
    // Suavizado: uno base que redondea la onda (para que sierra/cuadrada no
    // chirríen), + el del filtro (más oscuro → más suave), creciendo a la derecha.
    const fm = preset.engine === "fm";
    const base = 0.45;
    const kMax = fm
      ? base
      : Math.max(base, Math.min(0.9, 1.05 - preset.filter.cutoff / 5500));
    const delta = 0.16;

    ctx.strokeStyle = p.osc;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.shadowColor = p.line;
    ctx.shadowBlur = 6;
    ctx.beginPath();

    for (let x = 0; x <= W; x++) {
      const u = x / W;
      const ph = u * CYCLES;
      const raw = oscValue(preset, ph);

      // El suavizado entra suave desde la izquierda y llega a `kMax` a la derecha.
      const fk = kMax * (0.35 + 0.65 * u);
      const smooth =
        0.4 * raw +
        0.3 * oscValue(preset, ph - delta) +
        0.3 * oscValue(preset, ph + delta);
      const shaped = raw + (smooth - raw) * fk;

      // Envolvente: conforma la amplitud a lo largo de todo el ancho.
      const a = 0.12 + 0.88 * ampAt(preset.ampEnv, u);

      const y = MID - shaped * AMP * a;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
