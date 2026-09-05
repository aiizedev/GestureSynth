// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresetSelector } from "./PresetSelector";
import { PRESETS } from "../audio/presets";
import {
  saveUserPreset,
  STORAGE_KEY as USER_PRESETS_KEY,
} from "../audio/presets/userStore";
import type { TimbrePreset } from "../audio/presets/types";

let sel: PresetSelector;
let onChange: ReturnType<typeof vi.fn>;

function make() {
  onChange = vi.fn();
  sel = new PresetSelector({ onChange });
  return sel.element.querySelector<HTMLSelectElement>("select")!;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  sel?.dispose();
});

const IMPORTED: TimbrePreset = {
  ...(PRESETS.pad as TimbrePreset),
  filter: { ...(PRESETS.pad as TimbrePreset).filter, cutoff: 777 },
};

describe("PresetSelector — importar sin recargar", () => {
  it("applyImported guarda el sonido con nombre, lo selecciona en 'Mis presets' y lo aplica", () => {
    const select = make();
    sel.applyImported(IMPORTED, "Morat Acústico");

    expect([...select.options].some((o) => o.value === "user:Morat Acústico")).toBe(true);
    expect(select.value).toBe("user:Morat Acústico");
    expect(sel.current.filter.cutoff).toBe(777);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].filter.cutoff).toBe(777);

    // Persistido: un PresetSelector nuevo lo ve sin más.
    sel.dispose();
    const fresh = new PresetSelector({ onChange: vi.fn() });
    const values = [
      ...fresh.element.querySelectorAll<HTMLOptionElement>("select option"),
    ].map((o) => o.value);
    fresh.dispose();
    expect(values).toContain("user:Morat Acústico");
  });

  it("se puede volver al sonido importado tras elegir otro preset", () => {
    const select = make();
    sel.applyImported(IMPORTED, "Morat Acústico");

    select.value = "clean";
    select.dispatchEvent(new Event("change"));

    select.value = "user:Morat Acústico";
    select.dispatchEvent(new Event("change"));
    expect(onChange.mock.lastCall![0].filter.cutoff).toBe(777);
  });
});

describe("PresetSelector — presets de usuario en vivo", () => {
  it("un preset guardado en otra pestaña aparece tras el evento 'storage'", () => {
    const select = make();
    expect([...select.options].some((o) => o.value === "user:Cross Tab")).toBe(false);

    // Simula la escritura desde otra pestaña: localStorage ya tiene el dato y
    // llega el evento nativo (que en la misma pestaña NO se auto-dispara).
    localStorage.setItem(
      USER_PRESETS_KEY,
      JSON.stringify([{ name: "Cross Tab", preset: PRESETS.pad }]),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: USER_PRESETS_KEY }));

    expect([...select.options].some((o) => o.value === "user:Cross Tab")).toBe(true);
  });

  it("un preset guardado en la MISMA pestaña aparece por USER_PRESETS_EVENT", () => {
    const select = make();
    saveUserPreset("Same Tab", PRESETS.keys as TimbrePreset);
    expect([...select.options].some((o) => o.value === "user:Same Tab")).toBe(true);
  });
});
