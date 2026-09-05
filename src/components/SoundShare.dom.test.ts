// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundShare } from "./SoundShare";
import { AI_SOUND_PROMPT, serializeSound } from "../audio/presets/soundIO";
import { PRESETS } from "../audio/presets";
import type { TimbrePreset } from "../audio/presets/types";

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn(() => "blob:mock"),
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
});

function btn(root: HTMLElement, text: string): HTMLButtonElement {
  const found = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === text,
  );
  if (!found) throw new Error(`no hay botón "${text}"`);
  return found;
}

function make(current: TimbrePreset = PRESETS.pad as TimbrePreset) {
  const onImport = vi.fn();
  const share = new SoundShare({ getSound: () => current, onImport });
  document.body.innerHTML = "";
  document.body.append(share.element);
  return { share, onImport, el: share.element };
}

function fill(el: HTMLElement, opts: { name?: string; json?: string }): void {
  const popup = el.querySelector<HTMLElement>(".sound-share-popup")!;
  if (opts.name !== undefined) popup.querySelector<HTMLInputElement>("input[type=text]")!.value = opts.name;
  if (opts.json !== undefined) popup.querySelector<HTMLTextAreaElement>("textarea")!.value = opts.json;
}

describe("SoundShare", () => {
  it("muestra tres botones: Exportar / Importar / Pedir a una IA (sin JSON ni prompt a la vista)", () => {
    const { el } = make();
    const labels = [...el.querySelectorAll<HTMLButtonElement>(".sound-share-btn")].map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(["Exportar", "Importar", "Pedir a una IA"]);
    expect(el.querySelectorAll("textarea")).toHaveLength(1); // sólo el de importar
    expect(el.querySelector<HTMLDivElement>(".sound-share-popup")!.hidden).toBe(true);
    expect(el.textContent).not.toContain("version"); // el prompt no está en el DOM visible
  });

  it("'Exportar' descarga el .json del sonido actual", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { el } = make();
    btn(el, "Exportar").click();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("'Importar' despliega el popup con el campo de nombre y el textarea para pegar", () => {
    const { el } = make();
    btn(el, "Importar").click();
    const popup = el.querySelector<HTMLDivElement>(".sound-share-popup")!;
    expect(popup.hidden).toBe(false);
    expect(popup.querySelector("input[type=text]")).toBeTruthy();
    expect(popup.querySelector("textarea")).toBeTruthy();
  });

  it("nombre + JSON válido + 'Cargar' llama onImport(preset, name) y cierra el popup", () => {
    const { el, onImport } = make();
    btn(el, "Importar").click();
    fill(el, {
      name: "Mi Sonido",
      json: JSON.stringify({ version: 2, engine: "subtractive", filter: { cutoff: 512 } }),
    });
    btn(el, "Cargar").click();
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0][0].filter.cutoff).toBe(512);
    expect(onImport.mock.calls[0][1]).toBe("Mi Sonido");
    expect(el.querySelector<HTMLDivElement>(".sound-share-popup")!.hidden).toBe(true);
  });

  it("sin nombre no importa: marca el campo y pide un nombre", () => {
    const { el, onImport } = make();
    btn(el, "Importar").click();
    fill(el, { json: JSON.stringify({ version: 2, engine: "subtractive" }) });
    btn(el, "Cargar").click();
    expect(onImport).not.toHaveBeenCalled();
    const nameInput = el.querySelector<HTMLInputElement>(".sound-share-popup input[type=text]")!;
    expect(nameInput.getAttribute("aria-invalid")).toBe("true");
    expect(el.querySelector<HTMLElement>(".sound-share-status")!.textContent).toMatch(/nombre/i);
  });

  it("un nombre que choca con un preset de fábrica se rechaza", () => {
    const { el, onImport } = make();
    btn(el, "Importar").click();
    fill(el, { name: "Clean", json: JSON.stringify({ version: 2, engine: "subtractive" }) });
    btn(el, "Cargar").click();
    expect(onImport).not.toHaveBeenCalled();
    expect(el.querySelector<HTMLElement>(".sound-share-status")!.dataset.error).toBe("true");
  });

  it("un JSON inválido (con nombre) no llama onImport y marca error", () => {
    const { el, onImport } = make();
    btn(el, "Importar").click();
    fill(el, { name: "Roto", json: "nope" });
    btn(el, "Cargar").click();
    expect(onImport).not.toHaveBeenCalled();
    expect(el.querySelector<HTMLElement>(".sound-share-status")!.dataset.error).toBe("true");
  });

  it("'Pedir a una IA' sólo copia el prompt y lo confirma, sin abrir el popup", async () => {
    const { el } = make();
    btn(el, "Pedir a una IA").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(writeText).toHaveBeenCalledWith(AI_SOUND_PROMPT);
    expect(el.querySelector<HTMLDivElement>(".sound-share-popup")!.hidden).toBe(true);
    const status = el.querySelector<HTMLElement>(".sound-share-status")!;
    expect(status.textContent).toMatch(/instrucciones copiadas/i);
    expect(status.textContent).toMatch(/genere el sonido a partir de ellas/i);
    expect(status.textContent).not.toMatch(/pega aquí el json/i);
  });

  it("el JSON exportado coincide con serializeSound del sonido actual", () => {
    // (garantía del formato, aunque el usuario normal no lo vea)
    expect(serializeSound(PRESETS.pad as TimbrePreset)).toContain('"version": 2');
  });
});
