export interface KnobOptions {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Valor al que vuelve con doble clic. Por defecto, `value` inicial. */
  default?: number;
  /** Formato del número mostrado. Por defecto: el número tal cual + `unit`. */
  format?: (v: number) => string;
  unit?: string;
  size?: "macro" | "normal";
  onInput: (value: number) => void;
}

const ARC_START = 135; // grados; 0° = eje +X, sentido horario (Y hacia abajo)
const ARC_SWEEP = 270;
const SVG_NS = "http://www.w3.org/2000/svg";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * Potenciómetro (knob) reutilizable — estética de hardware, arrastre vertical.
 * No sabe nada de audio: sólo emite `number` por `onInput`.
 *
 * Interacción: arrastrar arriba/abajo, `Shift` para fino, doble clic para reset,
 * rueda y flechas de teclado para pasos.
 */
export class Knob {
  readonly element: HTMLDivElement;

  private readonly opts: Required<Omit<KnobOptions, "unit">> & { unit: string };
  private value: number;

  private readonly valueArc: SVGPathElement;
  private readonly pointer: SVGLineElement;
  private readonly valEl: HTMLSpanElement;

  private dragStartY = 0;
  private dragStartVal = 0;
  private dragging = false;

  constructor(options: KnobOptions) {
    this.opts = {
      default: options.value,
      format: (v) => String(v),
      unit: "",
      size: "normal",
      ...options,
    };
    this.value = this.snap(options.value);

    const box = this.opts.size === "macro" ? 96 : 64;
    const cx = box / 2;
    const cy = box / 2;
    const r = box / 2 - 8;

    this.element = document.createElement("div");
    this.element.className = `knob knob--${this.opts.size}`;
    this.element.tabIndex = 0;
    this.element.setAttribute("role", "slider");
    this.element.setAttribute("aria-label", this.opts.label);
    this.element.setAttribute("aria-valuemin", String(this.opts.min));
    this.element.setAttribute("aria-valuemax", String(this.opts.max));

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${box} ${box}`);
    svg.setAttribute("width", String(box));
    svg.setAttribute("height", String(box));

    const track = document.createElementNS(SVG_NS, "path");
    track.setAttribute("class", "knob-track");
    track.setAttribute(
      "d",
      arcPath(cx, cy, r, ARC_START, ARC_START + ARC_SWEEP),
    );

    this.valueArc = document.createElementNS(SVG_NS, "path");
    this.valueArc.setAttribute("class", "knob-arc");

    this.pointer = document.createElementNS(SVG_NS, "line");
    this.pointer.setAttribute("class", "knob-pointer");
    this.pointer.setAttribute("x1", String(cx));
    this.pointer.setAttribute("y1", String(cy));

    svg.append(track, this.valueArc, this.pointer);

    const labelEl = document.createElement("span");
    labelEl.className = "knob-label";
    labelEl.textContent = this.opts.label;

    this.valEl = document.createElement("span");
    this.valEl.className = "knob-val";

    this.element.append(svg, labelEl, this.valEl);
    this.renderValue(cx, cy, r);

    this.wire();
  }

  /** Fija el valor desde fuera (p. ej. al cargar un preset). No emite por defecto. */
  setValue(v: number, emit = false): void {
    this.value = this.snap(v);
    const box = this.opts.size === "macro" ? 96 : 64;
    this.renderValue(box / 2, box / 2, box / 2 - 8);
    if (emit) this.opts.onInput(this.value);
  }

  getValue(): number {
    return this.value;
  }

  // --- Interno -----------------------------------------------------------

  private snap(v: number): number {
    const { min, max, step } = this.opts;
    const snapped = Math.round((clamp(v, min, max) - min) / step) * step + min;
    return Number(clamp(snapped, min, max).toFixed(6));
  }

  private fraction(): number {
    const { min, max } = this.opts;
    return max === min ? 0 : (this.value - min) / (max - min);
  }

  private renderValue(cx: number, cy: number, r: number): void {
    const t = this.fraction();
    const ang = ARC_START + t * ARC_SWEEP;
    if (t <= 0.0001) {
      this.valueArc.setAttribute("d", "");
    } else {
      this.valueArc.setAttribute("d", arcPath(cx, cy, r, ARC_START, ang));
    }
    const [px, py] = polar(cx, cy, r - 3, ang);
    this.pointer.setAttribute("x2", px.toFixed(2));
    this.pointer.setAttribute("y2", py.toFixed(2));

    const text = this.opts.format(this.value) + this.opts.unit;
    this.valEl.textContent = text;
    this.element.setAttribute("aria-valuenow", String(this.value));
    this.element.setAttribute("aria-valuetext", text);
  }

  private wire(): void {
    this.element.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.element.focus();
      this.dragging = true;
      this.dragStartY = e.clientY;
      this.dragStartVal = this.value;
      this.element.classList.add("is-dragging");
      try {
        this.element.setPointerCapture(e.pointerId);
      } catch {
        /* sin puntero activo */
      }
    });

    this.element.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const range = this.opts.max - this.opts.min;
      const perPx = e.shiftKey ? range / 900 : range / 220;
      const dy = this.dragStartY - e.clientY;
      this.setValue(this.dragStartVal + dy * perPx, true);
    });

    const endDrag = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.element.classList.remove("is-dragging");
      try {
        this.element.releasePointerCapture(e.pointerId);
      } catch {
        /* ya liberado */
      }
    };
    this.element.addEventListener("pointerup", endDrag);
    this.element.addEventListener("pointercancel", endDrag);

    this.element.addEventListener("dblclick", (e) => {
      e.preventDefault();
      this.setValue(this.opts.default, true);
    });

    this.element.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const dir = e.deltaY < 0 ? 1 : -1;
        this.setValue(this.value + dir * this.opts.step, true);
      },
      { passive: false },
    );

    this.element.addEventListener("keydown", (e) => {
      const { step } = this.opts;
      let next: number | null = null;
      switch (e.key) {
        case "ArrowUp":
        case "ArrowRight":
          next = this.value + step;
          break;
        case "ArrowDown":
        case "ArrowLeft":
          next = this.value - step;
          break;
        case "PageUp":
          next = this.value + step * 10;
          break;
        case "PageDown":
          next = this.value - step * 10;
          break;
        case "Home":
          next = this.opts.min;
          break;
        case "End":
          next = this.opts.max;
          break;
        default:
          return;
      }
      e.preventDefault();
      this.setValue(next, true);
    });
  }
}
