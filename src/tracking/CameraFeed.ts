/**
 * Acceso a la cámara — sin `@mediapipe/tasks-vision`, sin `tone`.
 *
 * Envuelve `getUserMedia` en un `<video>` oculto y expone un ciclo de vida
 * simple (`start` / `stop` / `ready`). Los errores se clasifican para que la
 * vista muestre el mensaje correcto.
 */

export type CameraErrorKind = "denied" | "no-camera" | "insecure" | "error";

export interface CameraError extends Error {
  kind: CameraErrorKind;
}

const MESSAGES: Record<CameraErrorKind, string> = {
  denied: "Permiso de cámara denegado.",
  "no-camera": "No se detectó ninguna cámara.",
  insecure: "La cámara necesita HTTPS o localhost.",
  error: "No se pudo iniciar la cámara.",
};

function cameraError(kind: CameraErrorKind): CameraError {
  const err = new Error(MESSAGES[kind]) as CameraError;
  err.kind = kind;
  return err;
}

export interface CameraFeedOptions {
  /** Resolución máxima de captura (por defecto 1080p). Una cámara 2K/4K se
   *  limita a esto: menos píxeles que subir a la GPU por detección. */
  width?: number;
  height?: number;
}

export class CameraFeed {
  readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private readonly maxWidth: number;
  private readonly maxHeight: number;

  constructor(options: CameraFeedOptions = {}) {
    this.maxWidth = options.width ?? 1920;
    this.maxHeight = options.height ?? 1080;

    this.video = document.createElement("video");
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = true;
  }

  /** `true` cuando hay stream y el vídeo ya tiene dimensiones utilizables. */
  get ready(): boolean {
    return (
      this.stream !== null &&
      this.video.readyState >= 2 &&
      this.video.videoWidth > 0
    );
  }

  get resolution(): { width: number; height: number } {
    return { width: this.video.videoWidth, height: this.video.videoHeight };
  }

  async start(): Promise<void> {
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw cameraError("insecure");
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: this.maxWidth, max: this.maxWidth },
          height: { ideal: this.maxHeight, max: this.maxHeight },
        },
        audio: false,
      });
    } catch (err) {
      throw classify(err);
    }

    this.stream = stream;
    this.video.srcObject = stream;
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        this.video.removeEventListener("loadedmetadata", onReady);
        resolve();
      };
      this.video.addEventListener("loadedmetadata", onReady);
      this.video.play().catch(reject);
    });
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}

function classify(err: unknown): CameraError {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return cameraError("denied");
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return cameraError("no-camera");
  }
  return cameraError("error");
}
