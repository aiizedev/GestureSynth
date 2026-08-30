import * as Tone from "tone";
import type { TimbrePreset } from "./presets/types";
import { clonePreset, DEFAULT_PRESET } from "./presets";

/**
 * Envuelve un `Tone.PolySynth` y expone una API OPACA hacia el resto de la app.
 *
 * Nada de nodos de Tone sale de esta clase: ni el mapeo gestual ni la UI tocan
 * un `AudioParam` o un nodo crudo — todo pasa por estos métodos (ver CLAUDE.md).
 *
 * - Performance (acorde / volumen / trigger): `setChord`, `setVolume`, `noteOn`, `noteOff`.
 * - Timbre (motor / oscilador / filtro / envolventes / FX): `setTimbre`, `getCurrentTimbre`.
 *
 * Cadena de audio:
 *   poly → perfVol → distortion → chorus → delay → reverb → compresor → limiter → salida
 *   (el filtrado es POR VOZ, dentro de `Tone.MonoSynth`; el motor FM no filtra.)
 */
export class Synth {
  /**
   * La voz del `PolySynth` cambia en caliente entre `Tone.MonoSynth` (sustractivo)
   * y `Tone.FMSynth`, por eso el genérico es `any`: cada rama de `setTimbre` pasa
   * el `set()` con la forma correcta para el motor activo.
   */
  private poly!: Tone.PolySynth<any>;
  private engine: TimbrePreset["engine"] = "subtractive";

  private readonly perfVol: Tone.Volume;
  private readonly distortion: Tone.Distortion;
  private readonly chorus: Tone.Chorus;
  private readonly delay: Tone.FeedbackDelay;
  private readonly reverb: Tone.Reverb;
  private readonly comp: Tone.Compressor;
  private readonly limiter: Tone.Limiter;
  private readonly meter: Tone.Meter;

  /** Frecuencias del acorde actual (Hz). */
  private current: number[] = [];
  /** ¿Hay un pad mantenido pulsado ahora mismo? */
  private held = false;
  private ready = false;

  /** Última configuración de timbre aplicada (fuente para `getCurrentTimbre`). */
  private currentPreset: TimbrePreset;

  constructor() {
    this.perfVol = new Tone.Volume(-6);
    this.distortion = new Tone.Distortion({ distortion: 0, oversample: "2x" });
    this.chorus = new Tone.Chorus({
      frequency: 1.2,
      delayTime: 3.5,
      depth: 0.5,
      spread: 180,
      wet: 0,
    });
    this.delay = new Tone.FeedbackDelay({
      delayTime: "8n",
      feedback: 0.2,
      wet: 0,
    });
    this.reverb = new Tone.Reverb({ decay: 2.4, wet: 0.2 });
    // "Glue" del acorde: junta las voces y controla picos antes del limitador.
    this.comp = new Tone.Compressor({
      threshold: -18,
      ratio: 3,
      attack: 0.01,
      release: 0.15,
    });
    this.limiter = new Tone.Limiter(-1);
    this.meter = new Tone.Meter({ normalRange: true, smoothing: 0.8 });

    this.perfVol.chain(
      this.distortion,
      this.chorus,
      this.delay,
      this.reverb,
      this.comp,
      this.limiter,
      Tone.getDestination(),
    );
    this.limiter.connect(this.meter);

    this.currentPreset = clonePreset(DEFAULT_PRESET);
    this.buildVoice("subtractive");
  }

  /** (Re)crea la voz del PolySynth para el motor pedido y la reconecta. */
  private buildVoice(engine: TimbrePreset["engine"]): void {
    this.poly?.dispose();
    this.poly = (
      engine === "fm"
        ? new Tone.PolySynth(Tone.FMSynth)
        : new Tone.PolySynth(Tone.MonoSynth)
    ) as Tone.PolySynth<any>;
    this.poly.maxPolyphony = 12;
    this.poly.connect(this.perfVol);
    this.engine = engine;
  }

  /**
   * Arranca el audio. DEBE llamarse desde un gesto explícito del usuario (botón
   * "Empezar") — `Tone.start()` desbloquea el AudioContext. Además arranca el LFO
   * del chorus y espera a que la reverb genere su IR antes de dejar sonar nada.
   */
  async start(): Promise<void> {
    await Tone.start();
    if (this.ready) return;
    this.chorus.start();
    await this.reverb.ready;
    this.ready = true;
  }

  // --- Performance -----------------------------------------------------------

  /**
   * Fija el acorde activo como lista de frecuencias (Hz). La resolución
   * tonalidad + grado + voicing → frecuencias vive en `utils/musicTheory.ts`,
   * nunca aquí: este objeto sólo sabe de sonido.
   */
  setChord(frequencies: number[], glideTime = 0): void {
    this.current = frequencies.slice();
    this.poly.set({ portamento: glideTime });
    if (this.held) {
      this.poly.releaseAll();
      this.poly.triggerAttack(this.current, undefined, 0.8);
    }
  }

  /** Volumen de performance (la "mano derecha"), independiente del `master` del preset. */
  setVolume(db: number): void {
    this.perfVol.volume.rampTo(db, 0.03);
  }

  noteOn(): void {
    if (!this.ready || this.current.length === 0) return;
    this.held = true;
    this.poly.triggerAttack(this.current, undefined, 0.8);
  }

  noteOff(): void {
    this.held = false;
    this.poly.triggerRelease(this.current);
  }

  // --- Timbre --------------------------------------------------------------

  setTimbre(preset: TimbrePreset): void {
    if (preset.engine !== this.engine) {
      this.buildVoice(preset.engine);
    }

    if (preset.engine === "fm") {
      this.poly.set({
        harmonicity: preset.fm?.harmonicity ?? 2,
        modulationIndex: preset.fm?.modulationIndex ?? 6,
        oscillator: { type: preset.oscillator.waveform },
        modulation: { type: preset.fm?.modWaveform ?? "sine" },
        envelope: { ...preset.ampEnv },
        portamento: preset.glide,
      });
    } else {
      const unison = Math.max(0, Math.round(preset.oscillator.unison));
      const oscillator: Record<string, unknown> = {
        type:
          unison > 0
            ? `fat${preset.oscillator.waveform}`
            : preset.oscillator.waveform,
      };
      if (unison > 0) {
        oscillator.count = 1 + unison;
        oscillator.spread = preset.oscillator.spread;
      }
      this.poly.set({
        oscillator,
        envelope: { ...preset.ampEnv },
        filter: { Q: preset.filter.resonance, rolloff: preset.filter.rolloff },
        filterEnvelope: {
          attack: preset.filterEnv.attack,
          decay: preset.filterEnv.decay,
          sustain: preset.filterEnv.sustain,
          release: preset.filterEnv.release,
          baseFrequency: preset.filter.cutoff,
          octaves: preset.filter.envAmount,
        },
        portamento: preset.glide,
      });
    }

    // --- Cadena de efectos (común a los dos motores) -----------------------
    this.distortion.distortion = preset.drive;
    this.chorus.wet.rampTo(preset.fx.chorus, 0.1);
    this.delay.wet.rampTo(preset.fx.delay.wet, 0.1);
    this.delay.feedback.rampTo(preset.fx.delay.feedback, 0.1);
    this.delay.set({ delayTime: preset.fx.delay.time });
    this.reverb.wet.rampTo(preset.fx.reverb.wet, 0.1);
    // El decay regenera la IR (async y con coste): sólo al cambiar de preset.
    if (this.currentPreset.fx.reverb.decay !== preset.fx.reverb.decay) {
      this.reverb.decay = preset.fx.reverb.decay;
    }
    this.poly.volume.rampTo(preset.master, 0.05);

    // Si había un acorde sonando y se cambió de motor, re-dispararlo con el
    // timbre nuevo (el `dispose` del motor anterior cortó las voces).
    if (preset.engine !== this.currentPreset.engine && this.held) {
      this.poly.triggerAttack(this.current, undefined, 0.8);
    }

    this.currentPreset = clonePreset(preset);
  }

  getCurrentTimbre(): TimbrePreset {
    return clonePreset(this.currentPreset);
  }

  /** Nivel de salida normalizado 0..1 (para el medidor del HUD). */
  getLevel(): number {
    const v = this.meter.getValue();
    return Array.isArray(v) ? Math.max(...v) : v;
  }
}
