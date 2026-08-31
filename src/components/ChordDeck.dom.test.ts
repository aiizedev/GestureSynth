// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { ChordDeck } from "./ChordDeck";
import { PanelPerformanceSource } from "../tracking/PanelPerformanceSource";

const MAJOR_ROW = 0;
const MINOR_ROW = 1;

function padChord(root: HTMLElement, row: number, degreeIndex: number): string {
  const rows = root.querySelectorAll(".pad-row");
  const pads = rows[row].querySelectorAll(".pad");
  return pads[degreeIndex].querySelector(".pad-chord")?.textContent ?? "";
}

describe("ChordDeck — cifrado por grado", () => {
  let source: PanelPerformanceSource;
  let deck: ChordDeck;

  beforeEach(() => {
    source = new PanelPerformanceSource();
    deck = new ChordDeck(source);
  });

  it("cada pad muestra el acorde que dispara en la tonalidad por defecto (C mayor)", () => {
    const root = deck.element as HTMLElement;
    expect(padChord(root, MAJOR_ROW, 0)).toBe("C"); // I
    expect(padChord(root, MAJOR_ROW, 1)).toBe("D"); // II
    expect(padChord(root, MAJOR_ROW, 4)).toBe("G"); // V
    expect(padChord(root, MINOR_ROW, 0)).toBe("Cm"); // i
    expect(padChord(root, MINOR_ROW, 5)).toBe("Am"); // vi grado → A menor
  });

  it("el voicing cambia la extensión del cifrado", () => {
    const root = deck.element as HTMLElement;
    source.setChordConfig({ voicing: 3 });
    expect(padChord(root, MAJOR_ROW, 0)).toBe("Cmaj7");
    expect(padChord(root, MINOR_ROW, 0)).toBe("Cm7");
    source.setChordConfig({ voicing: 5 });
    expect(padChord(root, MAJOR_ROW, 0)).toBe("C(#5)");
    expect(padChord(root, MINOR_ROW, 0)).toBe("Cm(♭5)");
  });

  it("modo menor + círculo de quintas: F menor escribe los grados con bemoles", () => {
    const root = deck.element as HTMLElement;
    source.setChordConfig({ key: "F", keyMode: "minor" });
    expect(padChord(root, MINOR_ROW, 0)).toBe("Fm"); // i
    expect(padChord(root, MAJOR_ROW, 2)).toBe("Ab"); // III → La bemol mayor
    expect(padChord(root, MAJOR_ROW, 6)).toBe("Eb"); // VII → Mi bemol mayor
  });
});
