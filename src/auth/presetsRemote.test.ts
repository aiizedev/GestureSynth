// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const chan: Record<string, unknown> = {};
  chan.on = vi.fn(() => chan);
  chan.subscribe = vi.fn(() => chan);

  const selectResult = { data: [] as unknown[], error: null as unknown };
  const select = vi.fn(() => Promise.resolve(selectResult));
  const upsert = vi.fn(() => Promise.resolve({ error: null }));
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select, upsert, delete: del }));
  const getSession = vi.fn(() =>
    Promise.resolve({ data: { session: { user: { id: "user-1" } } } }),
  );
  const channel = vi.fn(() => chan);
  const removeChannel = vi.fn(() => Promise.resolve());

  return { chan, selectResult, select, upsert, eq, del, from, getSession, channel, removeChannel };
});

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: { getSession: h.getSession },
    from: h.from,
    channel: h.channel,
    removeChannel: h.removeChannel,
  },
}));

import { deleteRemote, listRemote, subscribeRemote, upsertRemote } from "./presetsRemote";

beforeEach(() => {
  vi.clearAllMocks();
  h.selectResult.data = [];
  h.selectResult.error = null;
});

describe("presetsRemote (con cliente)", () => {
  it("listRemote mapea updated_at (ISO) a ms epoch", async () => {
    h.selectResult.data = [
      { name: "A", preset: { version: 2 }, updated_at: "2026-01-01T00:00:00Z" },
    ];
    const rows = await listRemote();
    expect(h.from).toHaveBeenCalledWith("presets");
    expect(h.select).toHaveBeenCalledWith("name, preset, updated_at");
    expect(rows).toEqual([
      { name: "A", preset: { version: 2 }, updatedAt: Date.parse("2026-01-01T00:00:00Z") },
    ]);
  });

  it("listRemote devuelve [] si hay error", async () => {
    h.selectResult.error = { message: "boom" };
    expect(await listRemote()).toEqual([]);
  });

  it("upsertRemote envía user_id de la sesión + onConflict user_id,name", async () => {
    await upsertRemote("Nube 1", { version: 2 } as never);
    expect(h.upsert).toHaveBeenCalledWith(
      { user_id: "user-1", name: "Nube 1", preset: { version: 2 } },
      { onConflict: "user_id,name" },
    );
  });

  it("deleteRemote filtra por name (RLS acota al usuario)", async () => {
    await deleteRemote("Nube 1");
    expect(h.del).toHaveBeenCalled();
    expect(h.eq).toHaveBeenCalledWith("name", "Nube 1");
  });

  it("subscribeRemote abre un canal postgres_changes y devuelve teardown", () => {
    const cb = vi.fn();
    const off = subscribeRemote(cb);
    expect(h.channel).toHaveBeenCalledWith("presets-sync");
    expect(h.chan.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "presets" },
      expect.any(Function),
    );
    off();
    expect(h.removeChannel).toHaveBeenCalled();
  });
});
