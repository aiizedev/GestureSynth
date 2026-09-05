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

    // --- Motor -------------------------------------------------------
    const motorCell = document.createElement("div");
    motorCell.className = "tp-cell tp-motor";
    const motorLbl = document.createElement("span");
    motorLbl.className = "tp-lbl";
    motorLbl.textContent = "Motor";
    this.btn = document.createElement("button");
    this.btn.className = "start-btn";
    this.btn.type = "button";
    this.btn.textContent = "Empezar";
    motorCell.append(motorLbl, this.btn);

    // --- Volumen ---------------------------------------------------
    const volCell = document.createElement("div");
    volCell.className = "tp-cell tp-vol";
    const volLbl = document.createElement("span");
    volLbl.className = "tp-lbl";
    volLbl.textContent = "Volumen master";
    const volRead = document.createElement("div");
    volRead.className = "vol-read";
    const volNum = document.createElement("span");
    volNum.className = "vol-num";
    const volUnit = document.createElement("span");
    volUnit.className = "vol-unit";
    volUnit.textContent = "dB";
    volRead.append(volNum, volUnit);

    const vol = document.createElement("input");
    vol.type = "range";
    vol.className = "vol-slider";
    vol.min = "-40";
    vol.max = "0";
    vol.step = "1";
    vol.value = "-6";
    const paintVol = () => {
      volNum.textContent = vol.value.replace("-", "−");
      vol.style.setProperty(
        "--fill",
        `${((Number(vol.value) + 40) / 40) * 100}%`,
      );
      vol.setAttribute("aria-label", `Volumen master ${vol.value} dB`);
    };
    paintVol();
    vol.addEventListener("input", () => {
      paintVol();
      opts.onVolume(Number(vol.value));
    });
    volCell.append(volLbl, volRead, vol);

    // --- Nivel ---------------------------------------------------
    const meterWrap = document.createElement("div");
    meterWrap.className = "tp-cell meter-wrap";
    const meterText = document.createElement("span");
    meterText.className = "tp-lbl";
    meterText.textContent = "Nivel";
    this.meterCanvas = document.createElement("canvas");
    this.meterCanvas.width = 200;
    this.meterCanvas.height = 44;
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

    this.element.append(motorCell, volCell, meterWrap);
    this.drawMeter();
  }

  setMeterLevel(level: number): void {
    this.level = level;
    this.drawMeter();
  }

  /**
   * Campo de barras verticales que sigue el nivel de salida. El color sale del
   * acento vigente (`--accent`), así que cambia con el tema. Se repinta a ~60fps
   * desde el bucle reactivo de `main.ts` vía `setMeterLevel`.
   */
  private drawMeter(): void {
    const { width: W, height: H } = this.meterCanvas;
    const ctx = this.meterCtx;
    ctx.clearRect(0, 0, W, H);

    const accent =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim() || "#f3c69b";
    const lv = Math.max(0, Math.min(1, this.level));
    const n = 13;
    const gap = 4;
    const bw = (W - gap * (n - 1)) / n;
    const t = performance.now() / 1000;

    ctx.fillStyle = accent;
    for (let i = 0; i < n; i++) {
      // Silueta base para que en reposo se vea intencionado, + reacción al nivel.
      const profile = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.85 + 0.6));
      const wob = Math.abs(
        Math.sin(t * 5.5 + i * 0.7) * Math.sin(t * 2.1 + i * 1.3),
      );
      const h = Math.max(3, H * (0.28 * profile + lv * (0.32 + 0.68 * wob)));
      ctx.globalAlpha = 0.32 + 0.68 * (h / H);
      ctx.fillRect(i * (bw + gap), H - h, bw, h);
    }
    ctx.globalAlpha = 1;
  }
}
