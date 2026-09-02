/**
 * Fuente de landmarks de mano — EL ÚNICO fichero que importa
 * `@mediapipe/tasks-vision` (regla de aislamiento, igual que `tone` solo vive en
 * `audio/Synth.ts`).
 *
 * Carga el modelo `HandLandmarker`, corre `detectForVideo` frame a frame y
 * traduce el resultado crudo al modelo propio (`HandsFrame`), aplicando la
 * corrección de handedness por espejo y el suavizado EMA de `handModel.ts`.
 *
 * NO produce `GestureState` ni toca el audio. `subscribe` / `dispose` replican
 * la forma de `PanelPerformanceSource` para el swap futuro; el paso siguiente
 * será `HandTracker.ts` consumiendo estos frames para emitir `GestureState`.
 */
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import {
  correctHandedness,
  handednessLabel,
  smoothLandmarks,
  type HandObservation,
  type HandsFrame,
  type Landmark,
} from "./handModel";

export interface HandLandmarkerSourceOptions {
  /** Carpeta con los binarios wasm de tasks-vision. */
  wasmBase?: string;
  /** Ruta al modelo `hand_landmarker.task`. */
  modelAssetPath?: string;
  /** Máximo de manos a detectar (por defecto 2). */
  numHands?: number;
  /**
   * `true` (por defecto) si el preview se le muestra al usuario espejado, que es
   * el caso de `/gesture`: la handedness de MediaPipe ya coincide con la mano
   * real y se respeta. `false` la invierte (ver `correctHandedness`).
   */
  mirrored?: boolean;
  /**
   * Peso EMA del frame nuevo al suavizar landmarks, 0..1 (por defecto 0.6).
   * Más alto = menos latencia y más nervio; `1` = sin suavizar.
   */
  smoothing?: number;
  /** Backend de inferencia (por defecto "GPU"; "CPU" si el equipo da guerra). */
  delegate?: "GPU" | "CPU";
}

/** Assets vendorizados en `public/mediapipe/` (ver `npm run setup:mediapipe`). */
const LOCAL_WASM = "/mediapipe/wasm";
const LOCAL_MODEL = "/mediapipe/hand_landmarker.task";

type Listener = (frame: HandsFrame) => void;

export class HandLandmarkerSource {
  private readonly wasmBase: string;
  private readonly modelAssetPath: string;
  private readonly numHands: number;
  private readonly mirrored: boolean;
  private readonly smoothing: number;
  private readonly delegate: "GPU" | "CPU";

  private landmarker: HandLandmarker | null = null;
  private readonly listeners = new Set<Listener>();
  /** Último set de landmarks por lado, para el EMA entre frames. */
  private readonly lastByHand = new Map<string, Landmark[]>();

  constructor(options: HandLandmarkerSourceOptions = {}) {
    this.wasmBase = options.wasmBase ?? LOCAL_WASM;
    this.modelAssetPath = options.modelAssetPath ?? LOCAL_MODEL;
    this.numHands = options.numHands ?? 2;
    this.mirrored = options.mirrored ?? true;
    this.smoothing = options.smoothing ?? 0.6;
    this.delegate = options.delegate ?? "GPU";
  }

  get ready(): boolean {
    return this.landmarker !== null;
  }

  async init(): Promise<void> {
    if (this.landmarker) return;
    const fileset = await FilesetResolver.forVisionTasks(this.wasmBase);
    this.landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: this.modelAssetPath,
        delegate: this.delegate,
      },
      numHands: this.numHands,
      runningMode: "VIDEO",
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  /**
   * Detecta manos en el frame de vídeo. `timestampMs` debe ser estrictamente
   * creciente entre llamadas (`performance.now()` sirve). Emite el `HandsFrame`
   * a los suscriptores y lo devuelve.
   */
  detect(video: HTMLVideoElement, timestampMs: number): HandsFrame {
    if (!this.landmarker) {
      const empty: HandsFrame = { hands: [], timestampMs };
      this.emit(empty);
      return empty;
    }
    const raw = this.landmarker.detectForVideo(video, timestampMs);
    const frame: HandsFrame = {
      hands: this.toObservations(raw),
      timestampMs,
    };
    this.emit(frame);
    return frame;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.listeners.clear();
    this.lastByHand.clear();
    this.landmarker?.close();
    this.landmarker = null;
  }

  private toObservations(result: HandLandmarkerResult): HandObservation[] {
    const hands: HandObservation[] = [];
    const present = new Set<string>();

    for (let i = 0; i < result.landmarks.length; i++) {
      const category = result.handedness[i]?.[0];
      const handedness = correctHandedness(
        category?.categoryName ?? "Right",
        this.mirrored,
      );
      const next: Landmark[] = result.landmarks[i].map((p) => ({
        x: p.x,
        y: p.y,
        z: p.z,
      }));
      const smoothed = smoothLandmarks(
        this.lastByHand.get(handedness) ?? null,
        next,
        this.smoothing,
      );
      this.lastByHand.set(handedness, smoothed);
      present.add(handedness);

      hands.push({
        handedness,
        label: handednessLabel(handedness),
        score: category?.score ?? 0,
        landmarks: smoothed,
      });
    }

    // Olvida el estado EMA de una mano que ya salió de cuadro, para que al
    // volver a entrar no arrastre una posición vieja.
    for (const key of [...this.lastByHand.keys()]) {
      if (!present.has(key)) this.lastByHand.delete(key);
    }

    return hands;
  }

  private emit(frame: HandsFrame): void {
    for (const listener of this.listeners) listener(frame);
  }
}
