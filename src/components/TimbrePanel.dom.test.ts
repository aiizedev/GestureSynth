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
  synth = makeSynth();
  panel = new TimbrePanel(synth as unknown as Synth);
  document.body.innerHTML = "";
  document.body.append(panel.element);
});

describe("TimbrePanel", () => {
  it("aplica un preset v2 al construirse y muestra 4 macros", () => {
    expect(synth.setTimbre).toHaveBeenCalled();
    expect(lastPreset(synth).version).toBe(2);
    expect(panel.element.querySelectorAll(".macros .knob")).toHaveLength(4);
  });

  it("el dropdown ofrece los 14 presets de fábrica agrupados", () => {
    expect(panel.element.querySelectorAll("select option")).toHaveLength(14);
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
