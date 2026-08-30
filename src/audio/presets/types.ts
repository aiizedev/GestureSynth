export type Waveform = "sine" | "triangle" | "sawtooth" | "square";
export type Rolloff = -12 | -24 | -48;

export interface ADSR {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

/** Parámetros del motor FM (solo cuando `engine === "fm"`). */
export interface FmParams {
  harmonicity: number;
  modulationIndex: number;
  modWaveform: Waveform;
}

/**
 * Descripción serializable del timbre (esquema v2). Vive en un preset editable
 * desde el panel en pantalla (nunca lo toca el mapeo gestual). Se aplica vía
 * `Synth.setTimbre`. El campo `version` permite migrar presets viejos.
 */
export interface TimbrePreset {
  version: 2;
  /** Motor de síntesis: sustractivo (MonoSynth) o FM (FMSynth). */
  engine: "subtractive" | "fm";
  oscillator: {
    waveform: Waveform;
    /** Voces de unísono APILADAS ADEMÁS de la principal, 0..3. */
    unison: number;
    /** Detune del unísono en cents, 0..50. */
    spread: number;
  };
  fm?: FmParams;
  filter: {
    /** Frecuencia base de la envolvente de filtro, en Hz. */
    cutoff: number;
    /** Resonancia (Q), 0..12. */
    resonance: number;
    /** Pendiente del filtro en dB/octava. */
    rolloff: Rolloff;
    /** Barrido de la envolvente de filtro en octavas, 0..6. */
    envAmount: number;
  };
  /** Envolvente del filtro (solo motor sustractivo). */
  filterEnv: ADSR;
  /** Envolvente de amplitud. */
  ampEnv: ADSR;
  /** Cantidad de distorsión, 0..1. */
  drive: number;
  fx: {
    /** Mezcla húmeda del chorus, 0..1. */
    chorus: number;
    delay: {
      wet: number;
      time: "8n" | "8n." | "4n";
      feedback: number;
    };
    reverb: {
      wet: number;
      /** Cola de la reverb en s. OJO: cambiarlo regenera la IR (async) —
       *  solo se aplica al cargar un preset, nunca desde un macro. */
      decay: number;
    };
  };
  /** Portamento entre notas en s, 0..0.3. */
  glide: number;
  /** Volumen de salida del preset en dB (la "mano derecha" es aparte). */
  master: number;
}
