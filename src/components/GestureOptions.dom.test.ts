// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCENT_SWATCHES, GestureOptions } from "./GestureOptions";
import { PRESETS } from "../audio/presets";
import type { TimbrePreset } from "../audio/presets/types";

const ACCENT_KEY = "gesturesynth.gesture.accent";
const ADVANCED_KEY = "gesturesynth.gesture.advanced";
const DEFAULT_ACCENT = ACCENT_SWATCHES[0].hex;

function make() {
  const onAccent = vi.fn();
  const onAdvanced = vi.fn();
  const opts = new GestureOptions({ onAccent, onAdvanced });
  return { opts, onAccent, onAdvanced };
}

const swatches = (opts: GestureOptions) =>
  [...opts.element.querySelectorAll<HTMLButtonElement>(".swatch")];

beforeEach(() => {
  localStorage.clear();
});

describe("GestureOptions — paleta pastel", () => {
  it("pinta un botón por color de ACCENT_SWATCHES", () => {
    const { opts } = make();
    expect(swatches(opts)).toHaveLength(ACCENT_SWATCHES.length);
    expect(swatches(opts).map((b) => b.dataset.hex)).toEqual(
      ACCENT_SWATCHES.map((s) => s.hex),
    );
  });

  it("click en un swatch → onAccent + localStorage + aria-pressed exclusivo", () => {
    const { opts, onAccent } = make();
    const target = swatches(opts)[3];
    const hex = target.dataset.hex!;

    target.click();

    expect(onAccent).toHaveBeenCalledWith(hex);
    expect(localStorage.getItem(ACCENT_KEY)).toBe(hex);
    for (const b of swatches(opts)) {
      expect(b.getAttribute("aria-pressed")).toBe(String(b === target));
    }
  });

  it("restaura un color guardado de la paleta y marca su swatch", () => {
    const saved = ACCENT_SWATCHES[2].hex;
    localStorage.setItem(ACCENT_KEY, saved);
    const { opts } = make();

    expect(opts.accent).toBe(saved);
    const pressed = swatches(opts).filter(
      (b) => b.getAttribute("aria-pressed") === "true",
    );
    expect(pressed).toHaveLength(1);
    expect(pressed[0].dataset.hex).toBe(saved);
  });

  it("un valor guardado inválido cae al color por defecto", () => {
    localStorage.setItem(ACCENT_KEY, "no-es-hex");
    const { opts } = make();
    expect(opts.accent).toBe(DEFAULT_ACCENT);
  });

  it('la fila "Información avanzada" sigue funcionando', () => {
    const { opts, onAdvanced } = make();
    const chk = opts.element.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    )!;

    chk.checked = true;
    chk.dispatchEvent(new Event("change"));
    expect(onAdvanced).toHaveBeenLastCalledWith(true);
    expect(localStorage.getItem(ADVANCED_KEY)).toBe("1");

    chk.checked = false;
    chk.dispatchEvent(new Event("change"));
    expect(onAdvanced).toHaveBeenLastCalledWith(false);
    expect(localStorage.getItem(ADVANCED_KEY)).toBe("0");
  });
});

describe("GestureOptions — compartir sonido", () => {
  it("sin getSound/onImport no renderiza el bloque de compartir", () => {
    const { opts } = make();
    expect(opts.element.querySelector(".sound-share")).toBeNull();
  });

  it("con getSound/onImport aparecen Exportar/Importar y un import válido llama onImport", () => {
    const onAccent = vi.fn();
    const onAdvanced = vi.fn();
    const onImport = vi.fn();
    const opts = new GestureOptions({
      onAccent,
      onAdvanced,
      getSound: () => PRESETS.pad as TimbrePreset,
      onImport,
    });

    const share = opts.element.querySelector<HTMLElement>(".sound-share");
    expect(share).not.toBeNull();
    const labels = [...share!.querySelectorAll<HTMLButtonElement>(".sound-share-btn")].map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(["Exportar", "Importar", "Pedir a una IA"]);

    [...share!.querySelectorAll<HTMLButtonElement>("button")]
      .find((b) => b.textContent === "Importar")!
      .click();
    share!.querySelector<HTMLInputElement>(".sound-share-popup input[type=text]")!.value =
      "Sonido FM";
    share!.querySelector<HTMLTextAreaElement>(".sound-share-popup textarea")!.value =
      JSON.stringify({ version: 2, engine: "fm" });
    [...share!.querySelectorAll<HTMLButtonElement>("button")]
      .find((b) => b.textContent === "Cargar")!
      .click();

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0][0].engine).toBe("fm");
    expect(onImport.mock.calls[0][1]).toBe("Sonido FM");
  });
});
