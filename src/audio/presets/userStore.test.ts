// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  USER_PRESETS_EVENT,
  deleteUserPreset,
  getUserPreset,
  listUserPresets,
  mergeRemote,
  saveUserPreset,
  setPresetRemote,
} from "./userStore";
import { PRESETS } from "./index";
import type { TimbrePreset } from "./types";

const BASE = PRESETS.pad as TimbrePreset;
/** Dos presets iguales salvo el corte de filtro, para distinguir cuál quedó. */
const withCutoff = (cutoff: number): TimbrePreset => ({
  ...BASE,
  filter: { ...BASE.filter, cutoff },
});
const P_LOW = withCutoff(111);
const P_HIGH = withCutoff(999);

/** Escribe entradas crudas en localStorage (simula esquema viejo / otra pestaña). */
function seed(
  entries: Array<{ name: string; preset: TimbrePreset; updatedAt?: number }>,
): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

beforeEach(() => {
  localStorage.clear();
  setPresetRemote(null);
});
afterEach(() => {
  setPresetRemote(null);
});

describe("userStore — solo local (sin sesión)", () => {
  it("guarda, lee y borra igual que siempre", () => {
    saveUserPreset("Mi Pad", P_LOW);
    expect(listUserPresets().map((e) => e.name)).toEqual(["Mi Pad"]);
    expect(getUserPreset("Mi Pad")?.filter.cutoff).toBe(111);

    deleteUserPreset("Mi Pad");
    expect(listUserPresets()).toHaveLength(0);
  });

  it("persiste updatedAt al guardar; una entrada sin él se lee como 0", () => {
    const t0 = Date.now();
    saveUserPreset("A", P_LOW);
    expect(listUserPresets()[0].updatedAt).toBeGreaterThanOrEqual(t0);

    seed([{ name: "Viejo", preset: P_LOW }]); // sin updatedAt
    expect(listUserPresets()[0].updatedAt).toBe(0);
  });

  it("no lanza si no hay backend remoto", () => {
    expect(() => {
      saveUserPreset("X", P_LOW);
      deleteUserPreset("X");
    }).not.toThrow();
  });
});

describe("userStore — con backend remoto", () => {
  it("saveUserPreset y deleteUserPreset delegan en el remoto", () => {
    const upsert = vi.fn();
    const remove = vi.fn();
    setPresetRemote({ upsert, remove });

    saveUserPreset("Nube 1", P_HIGH);
    expect(upsert).toHaveBeenCalledWith(
      "Nube 1",
      expect.objectContaining({ version: 2 }),
    );

    deleteUserPreset("Nube 1");
    expect(remove).toHaveBeenCalledWith("Nube 1");
  });
});

describe("userStore — mergeRemote (last-write-wins)", () => {
  it("añade presets que solo están en la nube y emite USER_PRESETS_EVENT", () => {
    const listener = vi.fn();
    window.addEventListener(USER_PRESETS_EVENT, listener);

    const { toPush } = mergeRemote([
      { name: "Nube A", preset: P_LOW, updatedAt: 1000 },
    ]);

    expect(listUserPresets().map((e) => e.name)).toEqual(["Nube A"]);
    expect(toPush).toHaveLength(0);
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(USER_PRESETS_EVENT, listener);
  });

  it("la copia remota más nueva reemplaza la local", () => {
    seed([{ name: "Shared", preset: P_LOW, updatedAt: 100 }]);
    mergeRemote([{ name: "Shared", preset: P_HIGH, updatedAt: 500 }]);
    expect(getUserPreset("Shared")?.filter.cutoff).toBe(999);
  });

  it("la copia local más nueva se conserva y sale en toPush", () => {
    seed([{ name: "Shared", preset: P_HIGH, updatedAt: 9999 }]);
    const { toPush } = mergeRemote([
      { name: "Shared", preset: P_LOW, updatedAt: 500 },
    ]);
    expect(getUserPreset("Shared")?.filter.cutoff).toBe(999);
    expect(toPush.map((e) => e.name)).toContain("Shared");
  });

  it("un preset solo local (sin timestamp) sale en toPush para subirlo", () => {
    seed([{ name: "Local Only", preset: P_LOW }]);
    const { toPush } = mergeRemote([]);
    expect(toPush.map((e) => e.name)).toEqual(["Local Only"]);
  });
});
