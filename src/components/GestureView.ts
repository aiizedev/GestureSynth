/**
 * Vista de `/gesture` — sin `@mediapipe/tasks-vision`, sin `tone`.
 *
 * Estilo de la referencia de Eric Wei: cámara a pantalla completa, overlay de
 * "click para activar" y, abajo-centro, el acorde (análisis en romanos + acorde
 * exacto con notas, en la tonalidad elegida). Columna izquierda: tonalidad +
 * `leftControls` (preset) + enlace "crear sonidos" a `/`. Arriba a la derecha un
 * menú de opciones (color principal, HUD de identificación de manos).
 */
import { readChordIntent } from "../tracking/handChord";
import { dynamicsFromHeight, handHeight } from "../tracking/handDynamics";
import { assignHands, type HandObservation, type HandsFrame } from "../tracking/handModel";
import {
  fingersUp,
  handTilt,
  readVoicing,
  TILT_THRESHOLD,
  voicingEnum,
  type FingersUp,
  type VoicingIntent,
} from "../tracking/handPose";
import type { TimbrePreset } from "../audio/presets/types";
import type { ChordIntent } from "../utils/gestureMapping";
import { describeChord, DEGREE_LABELS } from "../utils/musicTheory";
import { GestureOptions } from "./GestureOptions";
import { HandOverlayCanvas } from "./HandOverlayCanvas";
import { KeySelector } from "./KeySelector";

/**
 * Sufijo del acorde. `roman` = true para el análisis (`ii` ya dice menor, la m7
 * se escribe explícita; alterados con `(♯5)`/`(♭5)`); false para el cifrado
 * exacto que se pega a la raíz (`Cm`, `Caug`, `Cdim`).
 */
function chordSuffix(
  quality: "major" | "minor",
  voicing: 1 | 3 | 4 | 5,
  roman: boolean,
): string {
  const maj = quality === "major";
  switch (voicing) {
    case 3:
      return maj ? "maj7" : "m7";
    case 4:
      return maj ? "7" : "dim7";
    case 5:
      return maj ? (roman ? "(♯5)" : "aug") : roman ? "(♭5)" : "dim";
    default:
      return maj || roman ? "" : "m";
  }
}

/** Lo que las manos indican en un frame: acorde + altura de la mano derecha. */
export interface PerformFrame {
  /** Acorde que indican las manos (`null` = sin mano izquierda fiable). */
  chord: ChordIntent | null;
  /** Altura de la mano derecha 0..1 (1 = arriba del todo), `null` si no hay. */
  rightHeight: number | null;
}

export interface GestureViewOptions {
  /** Arranca cámara + modelo; puede lanzar un `CameraError` con `.kind`. */
  onActivate: () => Promise<void>;
  /** Lectura de interpretación de cada frame (acorde + dinámica). */
  onPerform?: (frame: PerformFrame) => void;
  /** Controles extra en la columna izquierda, bajo el selector de tonalidad. */
  leftControls?: HTMLElement[];
  /** Sonido actual a exportar desde el menú ⚙ (junto con `onImport`). */
  getSound?: () => TimbrePreset;
  /** Aplicar y guardar un sonido importado desde el menú ⚙ con su nombre. */
  onImport?: (preset: TimbrePreset, name: string) => void;
}

const START_ERROR: Record<string, string> = {
  denied: "permiso de cámara denegado",
  "no-camera": "no se detectó ninguna cámara",
  insecure: "la cámara necesita HTTPS o localhost",
  error: "no se pudo iniciar la cámara",
};

// --- Aura audio-reactiva: nivel de salida del Synth → `--gesture-level` -----
/** El medidor de un pad suave da valores bajos (~0.05..0.25); esto lo abre. */
const LEVEL_GAIN = 6;
/** Expansión suave de la parte baja (0..1 → 0..1, más "vida" cerca de 0). */
const LEVEL_CURVE = 0.7;
/** Constantes del seguidor asimétrico: sube rápido, baja lento (cola musical). */
const LEVEL_ATTACK_MS = 90;
const LEVEL_RELEASE_MS = 700;

export class GestureView {
  readonly element: HTMLDivElement;

  private readonly overlay = new HandOverlayCanvas();
  private readonly aura: HTMLDivElement;
  private readonly startOverlay: HTMLDivElement;
  private readonly startText: HTMLDivElement;
  private readonly hud: HTMLDivElement;
  private readonly chordEl: HTMLDivElement;

  private readonly intervals: number[] = [];
  private lastTs = 0;
  private busy = false;
  private latest: HandsFrame | null = null;

  /** Nivel suavizado 0..1 que alimenta el aura (`--gesture-level`). */
  private level = 0;
  private lastLevelTs = 0;

  private chordKey = "C";
  private readonly onPerform?: (frame: PerformFrame) => void;

  constructor(opts: GestureViewOptions) {
    this.onPerform = opts.onPerform;

    this.element = document.createElement("div");
    this.element.className = "gesture-view";

    this.aura = document.createElement("div");
    this.aura.className = "gesture-aura";

    this.hud = document.createElement("div");
    this.hud.className = "gesture-hud";

    this.chordEl = document.createElement("div");
    this.chordEl.className = "gesture-chord";

    const options = new GestureOptions({
      onAccent: (hex) => this.element.style.setProperty("--gesture-accent", hex),
      onAdvanced: (show) => {
        this.hud.hidden = !show;
      },
      getSound: opts.getSound,
      onImport: opts.onImport,
    });
    this.element.style.setProperty("--gesture-accent", options.accent);
    this.element.style.setProperty("--gesture-level", "0");
    this.hud.hidden = !options.advanced;

    const keys = new KeySelector({
      key: this.chordKey,
      onChange: (k) => {
        this.chordKey = k;
        this.updateChord(this.latest);
      },
    });

    const leftPanel = document.createElement("div");
    leftPanel.className = "gesture-left";
    leftPanel.append(keys.element, ...(opts.leftControls ?? []));
    const create = document.createElement("a");
    create.className = "gesture-create";
    create.href = "/";
    create.textContent = "crear sonidos ↗";
    leftPanel.append(create);

    this.startOverlay = document.createElement("div");
    this.startOverlay.className = "gesture-start";
    const circle = document.createElement("div");
    circle.className = "start-circle";
    circle.textContent = "▶";
    this.startText = document.createElement("div");
    this.startText.className = "start-text";
    this.startText.textContent = "toca para activar la cámara";
    this.startOverlay.append(circle, this.startText);

    this.startOverlay.addEventListener("click", () => this.activate(opts.onActivate));

    this.element.append(
      this.overlay.element,
      this.aura,
      this.hud,
      this.chordEl,
      leftPanel,
      options.element,
      this.startOverlay,
    );
    this.renderHud(null);
    this.renderChord(null, null);
  }

  private async activate(onActivate: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.startText.classList.remove("start-error");
    this.startText.textContent = "activando…";
    try {
      await onActivate();
      this.startOverlay.classList.add("hidden");
      this.overlay.setDimmed(false);
    } catch (err) {
      const kind = (err as { kind?: string })?.kind ?? "error";
      this.startText.textContent = START_ERROR[kind] ?? START_ERROR.error;
      this.startText.classList.add("start-error");
      console.error(err);
    } finally {
      this.busy = false;
    }
  }

  /**
   * Nivel de salida del `Synth` (0..1) → intensidad del aura. Se llama en CADA
   * frame de animación (no solo en las detecciones), con un seguidor asimétrico
   * frame-rate-independiente: el aura florece rápido y se apaga con una cola
   * larga, siguiendo la envolvente real del pad.
   */
  setLevel(raw: number): void {
    const safe = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    const shaped = Math.pow(Math.min(1, safe * LEVEL_GAIN), LEVEL_CURVE);

    const now = performance.now();
    const dt = this.lastLevelTs ? now - this.lastLevelTs : 16;
    this.lastLevelTs = now;

    const tau = shaped > this.level ? LEVEL_ATTACK_MS : LEVEL_RELEASE_MS;
    const k = 1 - Math.exp(-dt / tau);
    this.level = Math.min(1, Math.max(0, this.level + (shaped - this.level) * k));

    this.element.style.setProperty("--gesture-level", this.level.toFixed(3));
  }

  /** Detección nueva: actualiza HUD + FPS + acorde y repinta. */
  update(video: HTMLVideoElement, frame: HandsFrame): void {
    if (this.lastTs > 0) {
      const dt = frame.timestampMs - this.lastTs;
      if (dt > 0) {
        this.intervals.push(dt);
        if (this.intervals.length > 24) this.intervals.shift();
      }
    }
    this.lastTs = frame.timestampMs;
    this.latest = frame;

    this.overlay.render(video, frame);
    this.renderHud(frame, video);
    this.updateChord(frame);
  }

  /**
   * Deriva el acorde del frame con la tonalidad vigente: lo pinta y lo emite a
   * `onChord` (que en `/gesture` lo manda al `Synth`).
   */
  private updateChord(frame: HandsFrame | null): void {
    const { left, right } = assignHands(frame?.hands ?? []);
    const intent = readChordIntent(left, right, this.chordKey, "major");
    const rawVoicing = right ? readVoicing(right) : null;
    this.onPerform?.({
      chord: intent,
      rightHeight: right ? handHeight(right) : null,
    });
    this.renderChord(intent, rawVoicing);
  }

  /**
   * Frame de animación intermedio (sin detección nueva): solo repinta el vídeo
   * con los últimos nodos, para que la cámara se vea fluida a ~60 fps aunque la
   * detección vaya a menos.
   */
  paint(video: HTMLVideoElement): void {
    this.overlay.render(video, this.latest ?? { hands: [], timestampMs: 0 });
  }

  private fps(): number {
    if (this.intervals.length === 0) return 0;
    const avg = this.intervals.reduce((a, b) => a + b, 0) / this.intervals.length;
    return avg > 0 ? Math.round(1000 / avg) : 0;
  }

  private renderHud(frame: HandsFrame | null, video?: HTMLVideoElement): void {
    const hands = frame?.hands ?? [];
    const roles = assignHands(hands);
    const res =
      video && video.videoWidth > 0
        ? `${video.videoWidth}×${video.videoHeight}`
        : "—";
    this.hud.innerHTML = `
      <div class="hud-title">identificación de manos</div>
      <div>manos: ${hands.length}</div>
      <div>${slot("izq", roles.left, true)}</div>
      <div>${slot("der", roles.right)}</div>
      <div>${dynLine(roles.right)}</div>
      <div>${this.fps()} fps · ${res}</div>
    `;
  }

  private renderChord(
    intent: ChordIntent | null,
    rawVoicing: VoicingIntent | null,
  ): void {
    if (intent === null) {
      this.chordEl.innerHTML =
        `<span class="chord-degree chord-idle">–</span>` +
        `<span class="chord-voicing chord-idle">sin mano izquierda</span>`;
      return;
    }

    const { degree, quality } = intent;
    const shape = voicingEnum(rawVoicing); // 1 | 3 | 4 | 5 — solo la forma
    const inverted = rawVoicing?.inverted ?? false;
    const d = describeChord(intent); // `intent.voicing` ya trae la inversión (2/6/7/8)

    // Arriba: análisis en números romanos (mayúscula = mayor, minúscula = menor)
    // + extensión (m7 explícita), SIN la inversión.
    const roman =
      (quality === "major"
        ? DEGREE_LABELS[degree - 1]
        : DEGREE_LABELS[degree - 1].toLowerCase()) +
      chordSuffix(quality, shape, true);

    // Abajo: el acorde exacto en la tonalidad. Con inversión: notación de barra
    // `Acorde/bajo` + las notas en el orden del voicing.
    const symbol =
      `${d.root}${chordSuffix(quality, shape, false)}` +
      (inverted ? `/${d.notes[0]}` : "");
    const exact = `${symbol}  ·  ${d.notes.join(" ")}`;

    this.chordEl.innerHTML =
      `<span class="chord-degree">${roman}</span>` +
      `<span class="chord-voicing">${exact}</span>`;
  }
}

function slot(
  name: string,
  obs: HandObservation | undefined,
  withTilt = false,
): string {
  if (!obs) return `<span class="hud-dim">${name}: —</span>`;
  const base = `${name}: ${obs.label} ${obs.score.toFixed(2)} · ${fingerGlyphs(fingersUp(obs))}`;
  if (!withTilt) return base;
  const t = handTilt(obs);
  const arrow =
    t >= TILT_THRESHOLD ? "▸ may" : t <= -TILT_THRESHOLD ? "◂ men" : "· vert";
  return `${base}  ${arrow}`;
}

/** Dinámica de la mano derecha: altura → volumen, y drive si pasa del umbral. */
function dynLine(right: HandObservation | undefined): string {
  if (!right) return `<span class="hud-dim">dinámica: —</span>`;
  const h = handHeight(right);
  const { volumeDb, drive } = dynamicsFromHeight(h);
  const volTxt =
    Math.abs(volumeDb) < 0.6
      ? `vol ${volumeDb.toFixed(1)} dB (diseño)`
      : `vol ${volumeDb > 0 ? "+" : ""}${volumeDb.toFixed(1)} dB`;
  const driveTxt = drive > 0 ? ` · drive ${Math.round(drive * 100)}%` : "";
  return `altura: ${Math.round(h * 100)}% · ${volTxt}${driveTxt}`;
}

/** T I M R P en mayúscula si el dedo está extendido, `·` si no. */
function fingerGlyphs(f: FingersUp): string {
  const g = (up: boolean, ch: string) => (up ? ch : "·");
  return (
    g(f.thumb, "T") +
    g(f.index, "I") +
    g(f.middle, "M") +
    g(f.ring, "R") +
    g(f.pinky, "P")
  );
}
