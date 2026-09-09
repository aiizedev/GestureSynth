// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Sin cliente Supabase configurado (faltan las env vars): todo es no-op seguro.
vi.mock("./supabaseClient", () => ({ supabase: null }));

import { deleteRemote, listRemote, subscribeRemote, upsertRemote } from "./presetsRemote";

describe("presetsRemote (sin cliente)", () => {
  it("listRemote → []", async () => {
    expect(await listRemote()).toEqual([]);
  });

  it("upsertRemote / deleteRemote no lanzan", async () => {
    await expect(upsertRemote("A", {} as never)).resolves.toBeUndefined();
    await expect(deleteRemote("A")).resolves.toBeUndefined();
  });

  it("subscribeRemote devuelve un teardown inofensivo", () => {
    const off = subscribeRemote(vi.fn());
    expect(() => off()).not.toThrow();
  });
});
