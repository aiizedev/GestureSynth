import type { PanelPerformanceSource } from "../tracking/PanelPerformanceSource";
import type { ChordIntent } from "../utils/gestureMapping";
import type { KeyMode, Voicing } from "../utils/musicTheory";
import {
  DEGREE_LABELS,
  describeChord,
  KEY_MODE_LABELS,
  KEY_MODES,
  KEY_NAMES,
  keyDisplayName,
  VOICING_LABELS,
} from "../utils/musicTheory";

interface PadCell {
  degree: number;
  quality: "major" | "minor";
  chordEl: HTMLElement;
}

/**
 * Sección de acordes (columna izquierda). Config de tonalidad / calidad /
 * voicing / octava + pads I–VII "hold to play". Escribe en `PanelPerformanceSource`.
 */
export class ChordDeck {
  readonly element: HTMLElement;

  /** Un pad por grado × calidad; guardamos su etiqueta de cifrado para refrescarla. */
  private readonly padCells: PadCell[] = [];
  private readonly unsubscribe: () => void;

  constructor(private readonly source: PanelPerformanceSource) {
    this.element = document.createElement("section");
    this.element.className = "panel";
    this.element.setAttribute("aria-disabled", "true");

    const h2 = document.createElement("h2");
    h2.textContent = "Acordes";
    this.element.append(h2);

    this.element.append(this.buildKeyField());
    this.element.append(this.buildRow());
    this.element.append(this.buildPadDeck());

    // Cada pad muestra el cifrado real que dispara; se recalcula con la tónica,
    // el modo y el voicing actuales.
    this.unsubscribe = this.source.subscribe((state) =>
      this.syncPadChords(state.chord),
    );
  }

  setEnabled(enabled: boolean): void {
    this.element.setAttribute("aria-disabled", String(!enabled));
  }

  dispose(): void {
    this.unsubscribe();
  }

  /** Reescribe el cifrado de cada pad para la config de tonalidad vigente. */
  private syncPadChords(chord: ChordIntent): void {
    for (const cell of this.padCells) {
      cell.chordEl.textContent = describeChord({
        key: chord.key,
        keyMode: chord.keyMode,
        degree: cell.degree,
        quality: cell.quality,
        voicing: chord.voicing,
        octave: chord.octave,
      }).symbol;
    }
  }

  /**
   * Tonalidad = tónica (12 cromáticas) × modo (mayor / menor natural) → las 12
   * tonalidades mayores y las 12 menores. El modo sólo cambia de qué escala
   * salen las raíces de los grados; la calidad de cada pad sigue siendo suya.
   *
   * La nomenclatura sigue el círculo de quintas: el `value` de cada opción es el
   * id estable con `#`, pero el texto se reescribe con bemoles en las
   * tonalidades del lado plano (F, Bb, Eb… / Dm, Gm, Cm…) al cambiar de modo.
   */
  private buildKeyField(): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "row";

    const keyField = document.createElement("div");
    keyField.className = "field";
    const keyLabel = document.createElement("label");
    keyLabel.textContent = "Tonalidad";
    const keySelect = document.createElement("select");
    for (const name of KEY_NAMES) {
      const opt = document.createElement("option");
      opt.value = name;
      keySelect.append(opt);
    }
    keySelect.value = "C";
    keySelect.addEventListener("change", () =>
      this.source.setChordConfig({ key: keySelect.value }),
    );
    keyField.append(keyLabel, keySelect);

    const modeField = document.createElement("div");
    modeField.className = "field";
    const modeLabel = document.createElement("label");
    modeLabel.textContent = "Modo";
    const modeSelect = document.createElement("select");
    for (const mode of KEY_MODES) {
      const opt = document.createElement("option");
      opt.value = mode;
      opt.textContent = KEY_MODE_LABELS[mode];
      modeSelect.append(opt);
    }
    modeSelect.value = "major";

    const relabelKeys = (mode: KeyMode) => {
      for (const opt of Array.from(keySelect.options)) {
        opt.textContent = keyDisplayName(opt.value, mode);
      }
    };
    relabelKeys("major");
    modeSelect.addEventListener("change", () => {
      const mode = modeSelect.value as KeyMode;
      relabelKeys(mode);
      this.source.setChordConfig({ keyMode: mode });
    });
    modeField.append(modeLabel, modeSelect);

    row.append(keyField, modeField);
    return row;
  }

  private buildRow(): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "row";

    const voicingField = document.createElement("div");
    voicingField.className = "field";
    const vLabel = document.createElement("label");
    vLabel.textContent = "Voicing";
    const vSelect = document.createElement("select");
    ([1, 2, 3, 4, 5, 6, 7, 8] as Voicing[]).forEach((v) => {
      const opt = document.createElement("option");
      opt.value = String(v);
      opt.textContent = `${v} — ${VOICING_LABELS[v]}`;
      vSelect.append(opt);
    });
    vSelect.addEventListener("change", () =>
      this.source.setChordConfig({ voicing: Number(vSelect.value) as Voicing }),
    );
    voicingField.append(vLabel, vSelect);

    const octField = document.createElement("div");
    octField.className = "field";
    const oLabel = document.createElement("label");
    oLabel.textContent = "Octava";
    const oSelect = document.createElement("select");
    [-1, 0, 1].forEach((o) => {
      const opt = document.createElement("option");
      opt.value = String(o);
      opt.textContent = o > 0 ? `+${o}` : String(o);
      oSelect.append(opt);
    });
    oSelect.value = "0";
    oSelect.addEventListener("change", () =>
      this.source.setChordConfig({ octave: Number(oSelect.value) }),
    );
    octField.append(oLabel, oSelect);

    row.append(voicingField, octField);
    return row;
  }

  /**
   * Dos filas de pads: mayores (I–VII) y menores (i–vii). Cada pad fija su propia
   * calidad, así se pueden combinar los 12 acordes mayores y los 12 menores de
   * cualquier tonalidad sin un toggle global (dominantes secundarias, préstamos).
   * La alteración de la quinta (aumentada / disminuida) es el voicing 5.
   */
  private buildPadDeck(): HTMLDivElement {
    const deck = document.createElement("div");
    deck.className = "pad-deck";
    deck.append(
      this.buildPadRow("major", "Mayores · I–VII"),
      this.buildPadRow("minor", "menores · i–vii"),
    );
    return deck;
  }

  private buildPadRow(
    quality: "major" | "minor",
    caption: string,
  ): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "pad-row";

    const cap = document.createElement("span");
    cap.className = "pad-row-label";
    cap.textContent = caption;

    const pads = document.createElement("div");
    pads.className = "pads";

    DEGREE_LABELS.forEach((roman, i) => {
      const degree = i + 1;
      const pad = document.createElement("button");
      pad.type = "button";
      pad.className = "pad";
      pad.dataset.quality = quality;

      const romanEl = document.createElement("span");
      romanEl.className = "pad-roman";
      romanEl.textContent = quality === "major" ? roman : roman.toLowerCase();
      const chordEl = document.createElement("span");
      chordEl.className = "pad-chord";
      pad.append(romanEl, chordEl);
      this.padCells.push({ degree, quality, chordEl });

      const press = (ev: PointerEvent) => {
        if (pad.dataset.held === "true") return;
        pad.dataset.held = "true";
        this.source.pressPad(degree, quality);
        // Mantener el pad "sonando" aunque el cursor salga del botón.
        try {
          pad.setPointerCapture(ev.pointerId);
        } catch {
          /* sin puntero activo (p. ej. eventos sintéticos): no pasa nada */
        }
      };
      const release = () => {
        if (pad.dataset.held !== "true") return;
        delete pad.dataset.held;
        this.source.releasePad();
      };

      pad.addEventListener("pointerdown", press);
      pad.addEventListener("pointerup", release);
      pad.addEventListener("pointercancel", release);
      pad.addEventListener("pointerleave", release);
      pads.append(pad);
    });

    row.append(cap, pads);
    return row;
  }
}
