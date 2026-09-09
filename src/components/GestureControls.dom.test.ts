// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GestureControls } from "./GestureControls";

let c: GestureControls;

beforeEach(() => {
  c = new GestureControls();
  document.body.append(c.element);
});
afterEach(() => {
  c.element.remove();
});

describe("GestureControls", () => {
  it("arranca oculto y con las dos manos documentadas", () => {
    expect(c.isOpen).toBe(false);
    expect(c.element.hidden).toBe(true);
    const text = c.element.textContent ?? "";
    expect(text).toMatch(/Mano izquierda/i);
    expect(text).toMatch(/Mano derecha/i);
    expect(text).toMatch(/grados I a V/i);
    expect(text).toMatch(/primera inversión/i);
    expect(text).toMatch(/volumen y distorsión/i);
  });

  it("open() y close() alternan la visibilidad", () => {
    c.open();
    expect(c.isOpen).toBe(true);
    expect(c.element.hidden).toBe(false);
    c.close();
    expect(c.isOpen).toBe(false);
  });

  it("el botón × cierra", () => {
    c.open();
    c.element.querySelector<HTMLButtonElement>(".gc-close")!.click();
    expect(c.isOpen).toBe(false);
  });

  it("el click en el fondo cierra, pero no en la tarjeta", () => {
    c.open();
    c.element.querySelector<HTMLElement>(".gc-card")!.click();
    expect(c.isOpen).toBe(true); // click dentro de la tarjeta: no cierra

    c.element.click(); // click en el backdrop
    expect(c.isOpen).toBe(false);
  });

  it("Escape cierra cuando está abierto", () => {
    c.open();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(c.isOpen).toBe(false);
  });

  it("toggle() abre y cierra", () => {
    c.toggle();
    expect(c.isOpen).toBe(true);
    c.toggle();
    expect(c.isOpen).toBe(false);
  });
});
