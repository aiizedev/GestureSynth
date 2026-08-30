import type { PanelPerformanceSource } from "../tracking/PanelPerformanceSource";
import type { Voicing } from "../utils/musicTheory";
import {
  DEGREE_LABELS,
  KEY_NAMES,
  VOICING_LABELS,
} from "../utils/musicTheory";

/**
 * Sección de acordes (columna izquierda). Config de tonalidad / calidad /
 * voicing / octava + pads I–VII "hold to play". Escribe en `PanelPerformanceSource`.
 */
export class ChordDeck {
  readonly element: HTMLElement;

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
  }

  setEnabled(enabled: boolean): void {
    this.element.setAttribute("aria-disabled", String(!enabled));
  }

  private buildKeyField(): HTMLDivElement {
    const field = document.createElement("div");
    field.className = "field";
    const label = document.createElement("label");
    label.textContent = "Tonalidad";
    const select = document.createElement("select");
    for (const name of KEY_NAMES) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = `${name} mayor`;
      select.append(opt);
    }
    select.value = "C";
    select.addEventListener("change", () =>
      this.source.setChordConfig({ key: select.value }),
    );
    field.append(label, select);
    return field;
  }

  private buildRow(): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "row";

    const voicingField = document.createElement("div");
    voicingField.className = "field";
    const vLabel = document.createElement("label");
    vLabel.textContent = "Voicing";
    const vSelect = document.createElement("select");
    ([1, 2, 3, 4, 5] as Voicing[]).forEach((v) => {
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
      pad.textContent = quality === "major" ? roman : roman.toLowerCase();

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
