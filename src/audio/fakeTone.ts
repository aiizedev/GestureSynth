/**
 * Sustituto de `tone` para TESTS (`vi.mock("tone", () => import("./fakeTone"))`).
 * NO se incluye en el build: nada del `src/` de la app lo importa.
 *
 * Simula lo justo para verificar la **planificación de voces** de `Synth` en
 * sucesión rápida de acordes: un `PolySynth` con un pool de voces, `maxPolyphony`,
 * releases con cola y un reloj virtual (`audioSim.advance`). Todo lo demás
 * (efectos, medidor, `getDestination`, `start`) son stubs inertes.
 */

interface SimVoice {
  note: string;
  owner: object;
  released: boolean;
  releaseAt: number;
}

/** Estado del "audio" simulado, inspeccionable desde el test. */
export const audioSim = {
  /** Reloj virtual en ms. */
  now: 0,
  /** Cola de release en ms (se toma del `envelope.release` del último `set`). */
  releaseMs: 1100,
  voices: [] as SimVoice[],
  /** Notas que `triggerAttack` NO pudo colocar por falta de polifonía. */
  drops: [] as Array<{ note: string; at: number }>,

  reset(): void {
    this.now = 0;
    this.releaseMs = 1100;
    this.voices = [];
    this.drops = [];
  },

  /** Avanza el reloj y libera las voces cuya cola de release ya terminó. */
  advance(ms: number): void {
    this.now += ms;
    this.voices = this.voices.filter(
      (v) => !(v.released && this.now - v.releaseAt >= this.releaseMs),
    );
  },

  /** Notas con voz EN ATAQUE (sostenidas de verdad, no en cola de release). */
  held(): Set<string> {
    return new Set(
      this.voices.filter((v) => !v.released).map((v) => v.note),
    );
  },

  /** Notas con cualquier voz viva (ataque o release aún sonando). */
  sounding(): Set<string> {
    return new Set(this.voices.map((v) => v.note));
  },
};

const toKeys = (notes: unknown): string[] =>
  (Array.isArray(notes) ? notes : [notes]).map((n) => String(n));

export class PolySynth {
  maxPolyphony = 32;
  readonly volume = { rampTo(): void {}, value: 0 };

  constructor(_voice?: unknown) {
    void _voice;
  }

  connect(): this {
    return this;
  }

  dispose(): void {
    audioSim.voices = audioSim.voices.filter((v) => v.owner !== this);
  }

  set(obj: Record<string, unknown>): void {
    const env = obj?.["envelope"] as { release?: number } | undefined;
    if (env && typeof env.release === "number") {
      audioSim.releaseMs = Math.max(1, env.release * 1000);
    }
  }

  triggerAttack(notes: unknown, _time?: unknown, _velocity?: unknown): void {
    for (const key of toKeys(notes)) {
      // Ya hay una voz atacando esa nota → PolySynth la re-dispara, no asigna otra.
      if (audioSim.voices.some((v) => v.note === key && !v.released)) continue;

      if (audioSim.voices.length >= this.maxPolyphony) {
        // Tone libera las voces en cola de forma perezosa: una que aún suena no
        // se puede reutilizar → la nota se pierde.
        audioSim.drops.push({ note: key, at: audioSim.now });
        continue;
      }
      audioSim.voices.push({
        note: key,
        owner: this,
        released: false,
        releaseAt: 0,
      });
    }
  }

  triggerRelease(notes: unknown, _time?: unknown): void {
    for (const key of toKeys(notes)) {
      const v = audioSim.voices.find((x) => x.note === key && !x.released);
      if (v) {
        v.released = true;
        v.releaseAt = audioSim.now;
      }
    }
  }
}

/** Nodo genérico inerte para toda la cadena de efectos + medidor. */
class FakeNode {
  readonly volume = { rampTo(): void {}, value: 0 };
  readonly wet = { rampTo(): void {}, value: 0 };
  readonly feedback = { rampTo(): void {}, value: 0 };
  distortion = 0;
  decay = 0;

  chain(): this {
    return this;
  }
  connect(): this {
    return this;
  }
  dispose(): void {}
  set(): void {}
  start(): this {
    return this;
  }
  getValue(): number {
    return 0;
  }
  get ready(): Promise<void> {
    return Promise.resolve();
  }
}

export const MonoSynth = class {};
export const FMSynth = class {};
export const Volume = FakeNode;
export const Distortion = FakeNode;
export const Chorus = FakeNode;
export const FeedbackDelay = FakeNode;
export const Reverb = FakeNode;
export const Compressor = FakeNode;
export const Limiter = FakeNode;
export const Meter = FakeNode;

export function getDestination(): FakeNode {
  return new FakeNode();
}

export async function start(): Promise<void> {}
