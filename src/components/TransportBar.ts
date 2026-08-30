/**
 * Barra de transporte: botón "Empezar" (requisito de gesto de usuario para el
 * audio, ver CLAUDE.md), volumen master y medidor de nivel.
 *
 * No importa Tone: el nivel se lo pasa `main.ts` vía `setMeterLevel`.
 */
export interface TransportBarOptions {
  onStart: () => Promise<void>;
  onVolume: (db: number) => void;
}

export class TransportBar {
  readonly element: HTMLDivElement;
  private readonly btn: HTMLButtonElement;
  private readonly meterCanvas: HTMLCanvasElement;
  private readonly meterCtx: CanvasRenderingContext2D;
  private level = 0;

  constructor(opts: TransportBarOptions) {
    this.element = document.createElement("div");
    this.element.className = "transport";

    this.btn = document.createElement("button");
    this.btn.className = "start-btn";
    this.btn.textContent = "Empezar";

    const volField = document.createElement("div");
    volField.className = "field";
    const volLabel = document.createElement("label");
    const vol = document.createElement("input");
    vol.type = "range";
    vol.min = "-40";
    vol.max = "0";
    vol.step = "1";
    vol.value = "-6";
    const paintVol = () => {
      volLabel.innerHTML = `Volumen master <span class="val">${vol.value} dB</span>`;
    };
    paintVol();
    vol.addEventListener("input", () => {
      paintVol();
      opts.onVolume(Number(vol.value));
    });
    volField.append(volLabel, vol);

    const meterWrap = document.createElement("div");
    meterWrap.className = "meter-wrap";
    const meterText = document.createElement("span");
    meterText.textContent = "nivel";
    this.meterCanvas = document.createElement("canvas");
    this.meterCanvas.width = 120;
    this.meterCanvas.height = 12;
    this.meterCtx = this.meterCanvas.getContext("2d")!;
    meterWrap.append(meterText, this.meterCanvas);

    this.btn.addEventListener("click", async () => {
      this.btn.disabled = true;
      this.btn.textContent = "Iniciando…";
      try {
        await opts.onStart();
        this.btn.textContent = "Sonando";
      } catch (err) {
        this.btn.disabled = false;
        this.btn.textContent = "Empezar";
        console.error(err);
      }
    });

    this.element.append(this.btn, volField, meterWrap);
    this.drawMeter();
  }

  setMeterLevel(level: number): void {
    this.level = level;
    this.drawMeter();
  }

  private drawMeter(): void {
    const { width, height } = this.meterCanvas;
    const ctx = this.meterCtx;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, width, height);
    const w = Math.max(0, Math.min(1, this.level)) * width;
    ctx.fillStyle = this.level > 0.9 ? "#ff6b6b" : "#7ee0c0";
    ctx.fillRect(0, 0, w, height);
  }
}
