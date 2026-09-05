// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TimbrePanel } from "./TimbrePanel";
import type { Synth } from "../audio/Synth";
import type { TimbrePreset } from "../audio/presets/types";

function makeSynth() {
  return {
    setTimbre: vi.fn(),
    setVolume: vi.fn(),
    setChord: vi.fn(),
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    start: vi.fn(),
    getLevel: () => 0,
    getCurrentTimbre: vi.fn(),
  };
}

function lastPreset(synth: ReturnType<typeof makeSynth>): TimbrePreset {
  const calls = synth.setTimbre.mock.calls;
  return calls[calls.length - 1][0] as TimbrePreset;
}

function knobByLabel(root: HTMLElement, label: string): HTMLElement {
  const knobs = [...root.querySelectorAll<HTMLElement>(".knob")];
  const found = knobs.find(
    (k) => k.querySelector(".knob-label")?.textContent === label,
  );
  if (!found) throw new Error(`no hay knob "${label}"`);
  return found;
}

function pressArrowUp(el: HTMLElement): void {
  el.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
  );
}

let synth: ReturnType<typeof makeSynth>;
let panel: TimbrePanel;

beforeEach(() => {
  localStorage.clear();
  synth = makeSynth();
  panel = new TimbrePanel(synth as unknown as Synth);
  document.body.innerHTML = "";
  document.body.append(panel.element);
});

function saveRowParts(root: HTMLElement) {
  const row = root.querySelector<HTMLElement>(".preset-save")!;
  const input = row.querySelector<HTMLInputElement>("input")!;
  const buttons = row.querySelectorAll<HTMLButtonElement>("button");
  return { input, saveBtn: buttons[0], deleteBtn: buttons[1] };
}

describe("TimbrePanel", () => {
  it("aplica un preset v2 al construirse y muestra 4 macros", () => {
    expect(synth.setTimbre).toHaveBeenCalled();
    expect(lastPreset(synth).version).toBe(2);
    expect(panel.element.querySelectorAll(".macros .knob")).toHaveLength(4);
  });

  it("el dropdown ofrece los 23 presets de fábrica agrupados", () => {
    expect(panel.element.querySelectorAll("select option")).toHaveLength(23);
    expect(
      panel.element.querySelectorAll("select optgroup").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("cambiar a un preset FM conmuta el motor y desactiva la sección de filtro", () => {
    const select = panel.element.querySelector("select")!;
    select.value = "epiano";
    select.dispatchEvent(new Event("change"));

    expect(lastPreset(synth).engine).toBe("fm");
    const filterSection = [
      ...panel.element.querySelectorAll<HTMLElement>(".timbre-section"),
    ].find((s) => s.querySelector("h3")?.textContent === "Filter")!;
    expect(filterSection.getAttribute("aria-disabled")).toBe("true");
  });

  it("volver a un preset sustractivo reactiva la sección de filtro", () => {
    const select = panel.element.querySelector("select")!;
    select.value = "epiano";
    select.dispatchEvent(new Event("change"));
    select.value = "pluck";
    select.dispatchEvent(new Event("change"));

    expect(lastPreset(synth).engine).toBe("subtractive");
    const filterSection = [
      ...panel.element.querySelectorAll<HTMLElement>(".timbre-section"),
    ].find((s) => s.querySelector("h3")?.textContent === "Filter")!;
    expect(filterSection.getAttribute("aria-disabled")).toBe("false");
  });

  it("el macro Brightness mueve el corte del filtro", () => {
    const before = lastPreset(synth).filter.cutoff;
    const brillo = knobByLabel(
      panel.element.querySelector(".macros")!,
      "Brightness",
    );
    for (let i = 0; i < 10; i++) pressArrowUp(brillo);
    const after = lastPreset(synth).filter.cutoff;
    expect(after).not.toBe(before);
    expect(lastPreset(synth).version).toBe(2);
  });

  it("un knob avanzado (Reverb) edita fx.reverb.wet en vivo", () => {
    const before = lastPreset(synth).fx.reverb.wet;
    const reverb = knobByLabel(panel.element, "Reverb");
    for (let i = 0; i < 5; i++) pressArrowUp(reverb);
    expect(lastPreset(synth).fx.reverb.wet).toBeGreaterThan(before);
  });
});

describe("TimbrePanel — guardar presets del usuario", () => {
  it("guarda el timbre actual y aparece en el dropdown bajo 'My presets'", () => {
    const { input, saveBtn } = saveRowParts(panel.element);
    input.value = "Mi Pad";
    saveBtn.click();

    const options = panel.element.querySelectorAll("select option");
    expect(options).toHaveLength(24);
    const groups = [
      ...panel.element.querySelectorAll<HTMLOptGroupElement>("select optgroup"),
    ];
    expect(groups.some((g) => g.label === "My presets")).toBe(true);

    const select = panel.element.querySelector<HTMLSelectElement>("select")!;
    expect(select.value).toBe("user:Mi Pad");
  });

  it("recargar el preset del usuario reaplica su timbre y habilita Delete", () => {
    const { input, saveBtn, deleteBtn } = saveRowParts(panel.element);
    for (let i = 0; i < 6; i++) pressArrowUp(knobByLabel(panel.element, "Reverb"));
    const savedWet = lastPreset(synth).fx.reverb.wet;
    input.value = "Wet One";
    saveBtn.click();

    const select = panel.element.querySelector<HTMLSelectElement>("select")!;
    select.value = "clean";
    select.dispatchEvent(new Event("change"));
    expect(lastPreset(synth).fx.reverb.wet).not.toBeCloseTo(savedWet, 5);

    select.value = "user:Wet One";
    select.dispatchEvent(new Event("change"));
    expect(lastPreset(synth).fx.reverb.wet).toBeCloseTo(savedWet, 5);
    expect(deleteBtn.disabled).toBe(false);
  });

  it("Delete quita el preset del usuario y vuelve a fábrica", () => {
    const { input, saveBtn, deleteBtn } = saveRowParts(panel.element);
    input.value = "Temp";
    saveBtn.click();
    expect(panel.element.querySelectorAll("select option")).toHaveLength(24);

    deleteBtn.click();
    expect(panel.element.querySelectorAll("select option")).toHaveLength(23);
    expect(
      [
        ...panel.element.querySelectorAll<HTMLOptGroupElement>("select optgroup"),
      ].some((g) => g.label === "My presets"),
    ).toBe(false);
    expect(deleteBtn.disabled).toBe(true);
  });

  it("no deja guardar con un nombre de preset de fábrica", () => {
    const { input, saveBtn } = saveRowParts(panel.element);
    input.value = "Clean";
    saveBtn.click();
    expect(panel.element.querySelectorAll("select option")).toHaveLength(23);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("un preset del usuario guardado persiste para un panel nuevo", () => {
    const { input, saveBtn } = saveRowParts(panel.element);
    input.value = "Persistente";
    saveBtn.click();

    const fresh = new TimbrePanel(makeSynth() as unknown as Synth);
    const values = [...fresh.element.querySelectorAll<HTMLOptionElement>("select option")].map(
      (o) => o.value,
    );
    expect(values).toContain("user:Persistente");
  });
});

describe("TimbrePanel — compartir sonido", () => {
  it("añade Exportar / Importar / Pedir a una IA a la fila de preset sin mover Save/Delete", () => {
    const row = panel.element.querySelector<HTMLElement>(".preset-save")!;
    const labels = [...row.querySelectorAll<HTMLButtonElement>(".sound-share-btn")].map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(["Exportar", "Importar", "Pedir a una IA"]);
    const { saveBtn, deleteBtn } = saveRowParts(panel.element);
    expect(saveBtn.textContent).toBe("Save");
    expect(deleteBtn.textContent).toBe("Delete");
  });

  it("Importar → nombre + JSON válido → Cargar aplica el timbre y lo guarda seleccionado", () => {
    [...panel.element.querySelectorAll<HTMLButtonElement>("button")]
      .find((b) => b.textContent === "Importar")!
      .click();

    const popup = panel.element.querySelector<HTMLElement>(".sound-share-popup")!;
    popup.querySelector<HTMLInputElement>("input[type=text]")!.value = "Morat Acústico";
    popup.querySelector<HTMLTextAreaElement>("textarea")!.value = JSON.stringify({
      version: 2,
      engine: "subtractive",
      fx: { reverb: { wet: 0.99 } },
    });
    [...panel.element.querySelectorAll<HTMLButtonElement>("button")]
      .find((b) => b.textContent === "Cargar")!
      .click();

    expect(lastPreset(synth).fx.reverb.wet).toBe(0.99);
    expect(lastPreset(synth).version).toBe(2);

    const select = panel.element.querySelector<HTMLSelectElement>("select")!;
    expect(select.value).toBe("user:Morat Acústico");
    expect(
      [...select.querySelectorAll<HTMLOptionElement>("option")].some(
        (o) => o.value === "user:Morat Acústico",
      ),
    ).toBe(true);
  });
});
