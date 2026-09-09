// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock del módulo de auth para poder controlar `isAuthConfigured` y la sesión
// (el resto de tests de TimbrePanel corren sin auth configurado y no lo tocan).
const h = vi.hoisted(() => {
  const state: { authCb: ((s: unknown) => void) | null } = { authCb: null };
  return {
    state,
    onAuthChange: vi.fn((cb: (s: unknown) => void) => {
      state.authCb = cb;
      return vi.fn();
    }),
  };
});

vi.mock("../auth/auth", () => ({
  isAuthConfigured: true,
  onAuthChange: h.onAuthChange,
}));

import { TimbrePanel } from "./TimbrePanel";
import type { Synth } from "../audio/Synth";

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

let panel: TimbrePanel;
const emit = (s: unknown) => h.state.authCb?.(s);
const note = () =>
  panel.element.querySelector<HTMLElement>(".preset-cloud-note")!;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  h.state.authCb = null;
  panel = new TimbrePanel(makeSynth() as unknown as Synth);
  document.body.innerHTML = "";
  document.body.append(panel.element);
});
afterEach(() => panel.dispose());

describe("TimbrePanel — nota nube", () => {
  it("con cuenta configurada y sin sesión, la nota es visible", () => {
    expect(note().hidden).toBe(false);
    expect(note().textContent).toMatch(/solo en este navegador/i);
    emit(null);
    expect(note().hidden).toBe(false);
  });

  it("al iniciar sesión la nota se oculta; al cerrarla vuelve", () => {
    emit({ user: { id: "u1" } });
    expect(note().hidden).toBe(true);
    emit(null);
    expect(note().hidden).toBe(false);
  });
});
