// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state: { authCb: ((s: unknown) => void) | null } = { authCb: null };
  const realtimeTeardown = vi.fn();
  return {
    state,
    realtimeTeardown,
    onAuthChange: vi.fn((cb: (s: unknown) => void) => {
      state.authCb = cb;
      return vi.fn();
    }),
    listRemote: vi.fn(() => Promise.resolve([] as unknown[])),
    upsertRemote: vi.fn(() => Promise.resolve()),
    deleteRemote: vi.fn(() => Promise.resolve()),
    subscribeRemote: vi.fn(() => realtimeTeardown),
    setPresetRemote: vi.fn(),
    mergeRemote: vi.fn(() => ({ toPush: [] as unknown[] })),
  };
});

vi.mock("./auth", () => ({ onAuthChange: h.onAuthChange }));
vi.mock("./presetsRemote", () => ({
  listRemote: h.listRemote,
  upsertRemote: h.upsertRemote,
  deleteRemote: h.deleteRemote,
  subscribeRemote: h.subscribeRemote,
}));
vi.mock("../audio/presets/userStore", () => ({
  setPresetRemote: h.setPresetRemote,
  mergeRemote: h.mergeRemote,
}));

import { initPresetSync, stopPresetSync } from "./presetSync";

const emit = (session: unknown) => h.state.authCb?.(session);
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

beforeEach(() => {
  stopPresetSync();
  vi.clearAllMocks();
  h.state.authCb = null;
  h.mergeRemote.mockReturnValue({ toPush: [] });
});
afterEach(() => stopPresetSync());

describe("presetSync", () => {
  it("initPresetSync se suscribe a onAuthChange una sola vez (idempotente)", () => {
    initPresetSync();
    initPresetSync();
    expect(h.onAuthChange).toHaveBeenCalledTimes(1);
  });

  it("al iniciar sesión: enchufa el remoto, fusiona y abre Realtime", async () => {
    initPresetSync();
    emit({ user: { id: "u1" } });

    expect(h.setPresetRemote).toHaveBeenCalledWith(
      expect.objectContaining({
        upsert: expect.any(Function),
        remove: expect.any(Function),
      }),
    );
    expect(h.subscribeRemote).toHaveBeenCalledTimes(1);
    expect(h.listRemote).toHaveBeenCalled();

    await flush();
    expect(h.mergeRemote).toHaveBeenCalled();
  });

  it("el remoto enchufado delega en upsertRemote / deleteRemote", () => {
    initPresetSync();
    emit({ user: { id: "u1" } });
    const remote = h.setPresetRemote.mock.calls[0][0] as {
      upsert: (n: string, p: unknown) => void;
      remove: (n: string) => void;
    };
    remote.upsert("N", { version: 2 });
    remote.remove("N");
    expect(h.upsertRemote).toHaveBeenCalledWith("N", { version: 2 });
    expect(h.deleteRemote).toHaveBeenCalledWith("N");
  });

  it("sube los presets de toPush y vuelve a fusionar para los timestamps", async () => {
    h.mergeRemote
      .mockReturnValueOnce({ toPush: [{ name: "L", preset: { version: 2 } }] })
      .mockReturnValue({ toPush: [] });

    initPresetSync();
    emit({ user: { id: "u1" } });
    await flush();

    expect(h.upsertRemote).toHaveBeenCalledWith("L", { version: 2 });
    expect(h.mergeRemote).toHaveBeenCalledTimes(2);
    expect(h.listRemote).toHaveBeenCalledTimes(2);
  });

  it("al cerrar sesión: desenchufa el remoto y corta Realtime", () => {
    initPresetSync();
    emit({ user: { id: "u1" } });
    h.setPresetRemote.mockClear();

    emit(null);
    expect(h.setPresetRemote).toHaveBeenCalledWith(null);
    expect(h.realtimeTeardown).toHaveBeenCalled();
  });
});
