/**
 * Tour guiado de `/` — foco sobre un elemento cada vez con una tarjeta que
 * explica qué hace. Cubre los botones importantes; del sintetizador sólo
 * describe las secciones (quien afina un sinte ya sabe usar los mandos).
 *
 * No se lanza solo: lo arranca el botón "¿Cómo funciona?" de la cabecera.
 * Sólo DOM: sin `tone`, sin `@mediapipe/tasks-vision`.
 */
export interface TourStep {
  /** A qué elemento apuntar (primer match en el documento). */
  selector: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    selector: ".start-btn",
    title: "Empezar",
    body: "Enciende el motor de sonido. El navegador exige un clic antes de dejar sonar el audio, así que púlsalo primero.",
  },
  {
    selector: ".tp-vol",
    title: "Volumen master",
    body: "El volumen general de salida, en dB. A su lado, el medidor «Nivel» muestra cuánto está sonando.",
  },
  {
    selector: ".panel-chords .row",
    title: "Tonalidad y modo",
    body: "Eliges la tónica y si la escala es mayor o menor. Debajo, «Voicing» y «Octava» cambian cómo se apila el acorde y en qué registro suena.",
  },
  {
    selector: ".pad-deck",
    title: "Pads de acordes",
    body: "Mantén pulsado un pad para tocar ese grado. La fila de arriba son los acordes mayores (I–VII) y la de abajo los menores (i–vii).",
  },
  {
    selector: ".preset-field",
    title: "Timbre · Presets",
    body: "Eliges un sonido de fábrica. En la fila de abajo le pones nombre y lo guardas como tuyo (Save / Delete). Export lo descarga como archivo e Import carga uno pegado o subido. «Pedir a una IA» copia un prompt al portapapeles para que una IA te diseñe un sonido, que luego cargas con Import.",
  },
  {
    selector: ".macros",
    title: "Timbre · Macros",
    body: "Cuatro mandos rápidos — Brightness, Thickness, Space y Motion — que mueven varios parámetros a la vez para dar forma al sonido sin entrar en detalle.",
  },
  {
    selector: ".advanced",
    title: "Timbre · Advanced",
    body: "Todos los potenciómetros del sintetizador, por secciones: Oscillator, Filter, Envelope y Effects. Aquí se afina el sonido a fondo.",
  },
  {
    selector: ".theme-picker",
    title: "Tema",
    body: "Cambia el color de acento de la interfaz. Se recuerda entre sesiones (y se sincroniza con /gesture).",
  },
  {
    selector: ".lets-play",
    title: "Let's play",
    body: "Te lleva a /gesture, donde tocas estos mismos acordes moviendo las manos frente a la cámara.",
  },
];

export class SiteTour {
  readonly element: HTMLDivElement;

  private readonly steps: readonly TourStep[];
  private readonly spot: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private readonly countEl: HTMLSpanElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly bodyEl: HTMLParagraphElement;
  private readonly prevBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;

  private idx = 0;
  private active = false;
  private readonly placeTimers: Array<ReturnType<typeof setTimeout>> = [];

  private readonly onReflow = () => this.place();
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.stop();
    else if (e.key === "ArrowRight") this.next();
    else if (e.key === "ArrowLeft") this.prev();
  };

  constructor(steps: readonly TourStep[] = TOUR_STEPS) {
    this.steps = steps;

    this.element = document.createElement("div");
    this.element.className = "site-tour";
    this.element.hidden = true;

    this.spot = document.createElement("div");
    this.spot.className = "st-spot";

    this.card = document.createElement("div");
    this.card.className = "st-card";

    this.countEl = document.createElement("span");
    this.countEl.className = "st-count";
    this.titleEl = document.createElement("h3");
    this.titleEl.className = "st-title";
    this.bodyEl = document.createElement("p");
    this.bodyEl.className = "st-body";

    const actions = document.createElement("div");
    actions.className = "st-actions";
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "st-skip";
    skip.textContent = "Saltar";
    skip.addEventListener("click", () => this.stop());
    this.prevBtn = document.createElement("button");
    this.prevBtn.type = "button";
    this.prevBtn.className = "st-prev";
    this.prevBtn.textContent = "Atrás";
    this.prevBtn.addEventListener("click", () => this.prev());
    this.nextBtn = document.createElement("button");
    this.nextBtn.type = "button";
    this.nextBtn.className = "st-next";
    this.nextBtn.textContent = "Siguiente";
    this.nextBtn.addEventListener("click", () => this.next());
    actions.append(skip, this.prevBtn, this.nextBtn);

    this.card.append(this.countEl, this.titleEl, this.bodyEl, actions);
    this.element.append(this.spot, this.card);
  }

  get running(): boolean {
    return this.active;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.idx = 0;
    this.element.hidden = false;
    window.addEventListener("resize", this.onReflow);
    window.addEventListener("scroll", this.onReflow, true);
    document.addEventListener("keydown", this.onKey);
    this.show();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.element.hidden = true;
    window.removeEventListener("resize", this.onReflow);
    window.removeEventListener("scroll", this.onReflow, true);
    document.removeEventListener("keydown", this.onKey);
    this.clearPlaceTimers();
  }

  next(): void {
    if (!this.active) return;
    if (this.idx >= this.steps.length - 1) {
      this.stop();
      return;
    }
    this.idx += 1;
    this.show();
  }

  prev(): void {
    if (!this.active || this.idx === 0) return;
    this.idx -= 1;
    this.show();
  }

  private show(): void {
    const step = this.steps[this.idx];
    const el = document.querySelector<HTMLElement>(step.selector);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });

    this.countEl.textContent = `${this.idx + 1} / ${this.steps.length}`;
    this.titleEl.textContent = step.title;
    this.bodyEl.textContent = step.body;
    this.prevBtn.disabled = this.idx === 0;
    this.nextBtn.textContent =
      this.idx === this.steps.length - 1 ? "Listo" : "Siguiente";

    this.place();
    // El scroll suave y la animación de entrada de `#app > *` tardan: recoloca
    // el foco varias veces durante el primer segundo.
    requestAnimationFrame(() => this.place());
    this.clearPlaceTimers();
    for (const ms of [120, 300, 550, 900]) {
      this.placeTimers.push(setTimeout(() => this.place(), ms));
    }
  }

  private clearPlaceTimers(): void {
    for (const t of this.placeTimers) clearTimeout(t);
    this.placeTimers.length = 0;
  }

  /** Coloca el recuadro de foco sobre el elemento y la tarjeta a su lado. */
  private place(): void {
    if (!this.active) return;
    const el = document.querySelector<HTMLElement>(this.steps[this.idx].selector);
    if (!el) {
      this.spot.style.display = "none";
      this.card.style.top = "50%";
      this.card.style.left = "50%";
      this.card.style.transform = "translate(-50%, -50%)";
      return;
    }

    const r = el.getBoundingClientRect();
    const pad = 6;
    this.spot.style.display = "";
    this.spot.style.top = `${r.top - pad}px`;
    this.spot.style.left = `${r.left - pad}px`;
    this.spot.style.width = `${r.width + pad * 2}px`;
    this.spot.style.height = `${r.height + pad * 2}px`;

    this.card.style.transform = "";
    const cardW = this.card.offsetWidth || 340;
    const cardH = this.card.offsetHeight || 170;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const below = r.bottom + 14;
    const top =
      below + cardH < vh - 12 ? below : Math.max(12, r.top - 14 - cardH);
    let left = r.left + r.width / 2 - cardW / 2;
    left = Math.max(12, Math.min(left, vw - cardW - 12));

    this.card.style.top = `${top}px`;
    this.card.style.left = `${left}px`;
  }
}
