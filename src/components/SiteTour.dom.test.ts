// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SiteTour, TOUR_STEPS, type TourStep } from "./SiteTour";

const STEPS: TourStep[] = [
  { selector: "#one", title: "Uno", body: "primero" },
  { selector: "#two", title: "Dos", body: "segundo" },
  { selector: "#three", title: "Tres", body: "tercero" },
];

let tour: SiteTour;

beforeEach(() => {
  tour = new SiteTour(STEPS);
  document.body.append(tour.element);
});

afterEach(() => {
  tour.stop();
  tour.element.remove();
});

const count = () => tour.element.querySelector(".st-count")!.textContent;
const title = () => tour.element.querySelector(".st-title")!.textContent;
const body = () => tour.element.querySelector(".st-body")!.textContent;
const nextBtn = () =>
  tour.element.querySelector<HTMLButtonElement>(".st-next")!;
const prevBtn = () =>
  tour.element.querySelector<HTMLButtonElement>(".st-prev")!;

describe("SiteTour", () => {
  it("arranca oculto y sin correr (no se lanza solo)", () => {
    expect(tour.running).toBe(false);
    expect(tour.element.hidden).toBe(true);
  });

  it("start() muestra el primer paso", () => {
    tour.start();
    expect(tour.running).toBe(true);
    expect(tour.element.hidden).toBe(false);
    expect(count()).toBe("1 / 3");
    expect(title()).toBe("Uno");
    expect(body()).toBe("primero");
    expect(prevBtn().disabled).toBe(true);
    expect(nextBtn().textContent).toBe("Siguiente");
  });

  it("Siguiente / Atrás recorren los pasos", () => {
    tour.start();
    nextBtn().click();
    expect(count()).toBe("2 / 3");
    expect(title()).toBe("Dos");
    expect(prevBtn().disabled).toBe(false);

    nextBtn().click();
    expect(count()).toBe("3 / 3");
    expect(nextBtn().textContent).toBe("Listo");

    prevBtn().click();
    expect(count()).toBe("2 / 3");
  });

  it("Atrás no baja del primero", () => {
    tour.start();
    prevBtn().click();
    expect(count()).toBe("1 / 3");
  });

  it("en el último paso, Siguiente cierra el tour", () => {
    tour.start();
    nextBtn().click();
    nextBtn().click(); // paso 3/3
    nextBtn().click(); // "Listo"
    expect(tour.running).toBe(false);
    expect(tour.element.hidden).toBe(true);
  });

  it("Saltar cierra el tour", () => {
    tour.start();
    tour.element.querySelector<HTMLButtonElement>(".st-skip")!.click();
    expect(tour.running).toBe(false);
    expect(tour.element.hidden).toBe(true);
  });

  it("Escape cierra el tour", () => {
    tour.start();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(tour.running).toBe(false);
  });

  it("las flechas del teclado navegan", () => {
    tour.start();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(count()).toBe("2 / 3");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(count()).toBe("1 / 3");
  });

  it("los pasos por defecto cubren los controles clave", () => {
    const selectors = TOUR_STEPS.map((s) => s.selector);
    expect(selectors).toContain(".start-btn");
    expect(selectors).toContain(".pad-deck");
    expect(selectors).toContain(".macros");
    expect(selectors).toContain(".advanced");
    expect(selectors).toContain(".lets-play");
  });
});
