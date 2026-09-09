// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const teardown = vi.fn();
  return {
    teardown,
    signIn: vi.fn(),
    signOut: vi.fn(),
    onAuthChange: vi.fn((_cb: (s: unknown) => void) => teardown),
    cleanupAuthUrl: vi.fn(),
  };
});

vi.mock("../auth/auth", () => ({
  isAuthConfigured: true,
  signIn: mocks.signIn,
  signOut: mocks.signOut,
  getSession: vi.fn().mockResolvedValue(null),
  onAuthChange: mocks.onAuthChange,
  cleanupAuthUrl: mocks.cleanupAuthUrl,
  userFromSession: (s: {
    user: { email?: string; user_metadata: Record<string, string> };
  } | null) =>
    s
      ? {
          name: s.user.user_metadata.name,
          email: s.user.email ?? "",
          avatarUrl: s.user.user_metadata.avatar_url ?? null,
        }
      : null,
}));

import { AccountButton } from "./AccountButton";

const FAKE_SESSION = {
  user: {
    email: "ada@example.com",
    user_metadata: {
      name: "Ada",
      avatar_url: "https://img.example/a.png",
    },
  },
};

/** Dispara el callback que `AccountButton` pasó a `onAuthChange`. */
function emit(session: unknown): void {
  mocks.onAuthChange.mock.calls[0][0](session);
}

let comp: AccountButton | undefined;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  comp?.dispose();
  comp = undefined;
  document.body.innerHTML = "";
});

const btn = () =>
  comp!.element.querySelector<HTMLButtonElement>(".account-btn")!;
const text = () => comp!.element.textContent ?? "";

describe("AccountButton", () => {
  it("sin sesión muestra «Entrar con Google» y llama a signIn", () => {
    comp = new AccountButton("full");
    expect(mocks.cleanupAuthUrl).toHaveBeenCalled();
    emit(null);

    expect(btn().textContent).toBe("Entrar con Google");
    btn().click();
    expect(mocks.signIn).toHaveBeenCalledWith("google");
  });

  it("la variante full explica que la cuenta es opcional", () => {
    comp = new AccountButton("full");
    emit(null);
    expect(text()).toMatch(/no necesita cuenta/i);
  });

  it("la variante compact usa clase y explicación cortas", () => {
    comp = new AccountButton("compact");
    emit(null);
    expect(comp.element.classList.contains("account-compact")).toBe(true);
    expect(text()).toMatch(/guardar tus presets/i);
    expect(text()).not.toMatch(/no necesita cuenta/i);
  });

  it("con sesión muestra nombre, avatar y «Salir»; salir llama a signOut", () => {
    comp = new AccountButton("full");
    emit(FAKE_SESSION);

    expect(text()).toContain("Ada");
    const img = comp.element.querySelector<HTMLImageElement>("img.account-avatar");
    expect(img?.getAttribute("src")).toBe("https://img.example/a.png");
    expect(btn().textContent).toBe("Salir");

    btn().click();
    expect(mocks.signOut).toHaveBeenCalled();
  });

  it("compact con sesión: avatar + title, SIN botón «Salir» (solo se cierra en /)", () => {
    comp = new AccountButton("compact");
    emit(FAKE_SESSION);
    expect(comp.element.title).toBe("Ada · ada@example.com");
    expect(comp.element.querySelector("img.account-avatar")).not.toBeNull();
    expect(comp.element.querySelector(".account-btn")).toBeNull();
    expect(comp.element.textContent).not.toMatch(/salir/i);
  });

  it("dispose() corta la suscripción", () => {
    comp = new AccountButton("full");
    emit(null);
    comp.dispose();
    comp = undefined;
    expect(mocks.teardown).toHaveBeenCalledTimes(1);
  });
});
