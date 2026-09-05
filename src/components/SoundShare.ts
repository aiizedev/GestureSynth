import type { TimbrePreset } from "../audio/presets/types";
import { PRESET_LABELS, PRESET_NAMES, type PresetName } from "../audio/presets";
import {
  AI_SOUND_PROMPT,
  parseSound,
  serializeSound,
  SOUND_FILENAME,
} from "../audio/presets/soundIO";

/**
 * Dos botones para NO-expertos: "Exportar" (descarga el sonido actual como
 * `.json` para compartirlo) e "Importar" (abre un popup para pegar el JSON de
 * un sonido — el que te dé una IA o te pase otra persona — o subir un archivo).
 * El JSON nunca se muestra en la interfaz normal; sólo en el popup de importar.
 *
 * Se usa igual en `/` (colgado de la fila de preset) y en `/gesture` (dentro del
 * menú ⚙). Sin `tone`.
 */
export interface SoundShareOptions {
  /** Sonido actual a exportar. */
  getSound: () => TimbrePreset;
  /** Aplicar y GUARDAR un sonido importado válido con el nombre que puso el usuario. */
  onImport: (preset: TimbrePreset, name: string) => void;
}

/** ¿El nombre choca con un preset de fábrica (id o etiqueta visible)? */
function clashesWithFactory(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    PRESET_NAMES.includes(name as PresetName) ||
    Object.values(PRESET_LABELS).some((l) => l.toLowerCase() === lower)
  );
}

async function copyText(text: string, fallback?: HTMLTextAreaElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (fallback) {
      fallback.focus();
      fallback.select();
      try {
        return document.execCommand("copy");
      } catch {
        /* el texto queda seleccionado para copia manual */
      }
    }
    return false;
  }
}

function downloadText(text: string, filename: string): boolean {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return false;
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export class SoundShare {
  readonly element: HTMLDivElement;

  private readonly exportBtn: HTMLButtonElement;
  private readonly importBtn: HTMLButtonElement;
  private readonly aiBtn: HTMLButtonElement;
  private readonly popup: HTMLDivElement;
  private readonly nameInput: HTMLInputElement;
  private readonly importArea: HTMLTextAreaElement;
  private readonly status: HTMLParagraphElement;

  private open = false;
  private closeOnOutside?: (ev: MouseEvent) => void;
  private flashTimer?: ReturnType<typeof setTimeout>;
  private statusTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly opts: SoundShareOptions) {
    this.element = document.createElement("div");
    this.element.className = "sound-share";

    this.exportBtn = document.createElement("button");
    this.exportBtn.type = "button";
    this.exportBtn.className = "sound-share-btn";
    this.exportBtn.textContent = "Exportar";
    this.exportBtn.addEventListener("click", () => this.doExport());

    this.importBtn = document.createElement("button");
    this.importBtn.type = "button";
    this.importBtn.className = "sound-share-btn";
    this.importBtn.textContent = "Importar";
    this.importBtn.setAttribute("aria-expanded", "false");
    this.importBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.aiBtn = document.createElement("button");
    this.aiBtn.type = "button";
    this.aiBtn.className = "sound-share-btn";
    this.aiBtn.textContent = "Pedir a una IA";
    this.aiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.requestFromAi();
    });

    this.status = document.createElement("p");
    this.status.className = "sound-share-status";
    this.status.setAttribute("aria-live", "polite");

    this.nameInput = document.createElement("input");
    this.nameInput.type = "text";
    this.nameInput.placeholder = "Nombre del sonido";
    this.nameInput.setAttribute("aria-label", "Nombre del sonido importado");
    this.nameInput.addEventListener("input", () =>
      this.nameInput.removeAttribute("aria-invalid"),
    );

    this.importArea = document.createElement("textarea");
    this.importArea.rows = 5;
    this.importArea.placeholder = "Pega aquí el JSON…";
    this.importArea.setAttribute("aria-label", "JSON del sonido a importar");

    const actions = document.createElement("div");
    actions.className = "sound-share-actions";
    actions.append(this.exportBtn, this.importBtn, this.aiBtn);

    this.popup = this.buildPopup();

    // `status` va FUERA del popup (visible aunque el popup esté cerrado, p. ej.
    // tras "Pedir a una IA"); `:empty` lo oculta cuando no hay mensaje.
    this.element.append(actions, this.status, this.popup);
  }

  // --- Exportar ---------------------------------------------------------

  private doExport(): void {
    const ok = downloadText(serializeSound(this.opts.getSound()), SOUND_FILENAME);
    this.flashExport(ok ? "Exportado ✓" : "No se pudo exportar");
  }

  private flashExport(msg: string): void {
    clearTimeout(this.flashTimer);
    this.exportBtn.textContent = msg;
    this.exportBtn.disabled = true;
    this.flashTimer = setTimeout(() => {
      this.exportBtn.textContent = "Exportar";
      this.exportBtn.disabled = false;
    }, 1600);
  }

  // --- Importar (popup) ----------------------------------------------

  private buildPopup(): HTMLDivElement {
    const popup = document.createElement("div");
    popup.className = "sound-share-popup";
    popup.hidden = true;

    const hint = document.createElement("p");
    hint.className = "sound-share-hint";
    hint.textContent =
      "Ponle un nombre, pega el JSON del sonido (el que te devuelva la IA, o el de otra persona) y pulsa Cargar. También puedes subir un archivo .json.";

    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.textContent = "Cargar";
    loadBtn.addEventListener("click", () => this.applyFromText(this.importArea.value));

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";
    fileInput.hidden = true;
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (!this.nameInput.value.trim()) {
        this.nameInput.value = file.name.replace(/\.json$/i, "").trim();
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        this.importArea.value = text;
        this.applyFromText(text);
      };
      reader.onerror = () => this.setStatus("No se pudo leer el archivo.", true);
      reader.readAsText(file);
      fileInput.value = "";
    });

    const fileBtn = document.createElement("button");
    fileBtn.type = "button";
    fileBtn.textContent = "Subir archivo";
    fileBtn.addEventListener("click", () => fileInput.click());

    const row = document.createElement("div");
    row.className = "btn-row";
    row.append(loadBtn, fileBtn);

    popup.append(hint, this.nameInput, this.importArea, row, fileInput);
    return popup;
  }

  private toggle(): void {
    if (this.open) this.closePopup();
    else this.openPopup();
  }

  private openPopup(): void {
    this.open = true;
    this.popup.hidden = false;
    this.importBtn.setAttribute("aria-expanded", "true");
    this.nameInput.value = "";
    this.nameInput.removeAttribute("aria-invalid");
    this.importArea.value = "";
    this.setStatus("");
    this.nameInput.focus();
    if (!this.closeOnOutside) {
      this.closeOnOutside = (ev) => {
        if (!this.element.contains(ev.target as Node)) this.closePopup();
      };
      document.addEventListener("click", this.closeOnOutside);
    }
  }

  private closePopup(): void {
    this.open = false;
    this.popup.hidden = true;
    this.importBtn.setAttribute("aria-expanded", "false");
    if (this.closeOnOutside) {
      document.removeEventListener("click", this.closeOnOutside);
      this.closeOnOutside = undefined;
    }
  }

  /**
   * "Pedir a una IA": copia el prompt al portapapeles (el usuario NO lo ve) y
   * lo confirma. NO abre el popup — importar el resultado es tarea del botón
   * "Importar".
   */
  private async requestFromAi(): Promise<void> {
    const ok = await copyText(AI_SOUND_PROMPT);
    this.setStatus(
      ok
        ? "Instrucciones copiadas. Pídele a la IA que genere el sonido a partir de ellas."
        : "No se pudo copiar al portapapeles.",
      !ok,
    );
    if (ok) {
      this.statusTimer = setTimeout(() => this.setStatus(""), 8000);
    }
  }

  private applyFromText(text: string): void {
    const name = this.nameInput.value.trim();
    if (!name || clashesWithFactory(name)) {
      this.nameInput.setAttribute("aria-invalid", "true");
      this.nameInput.focus();
      this.setStatus(
        name ? `Ya hay un sonido de fábrica llamado «${name}». Elige otro nombre.` : "Ponle un nombre al sonido.",
        true,
      );
      return;
    }
    const result = parseSound(text);
    if (!result.ok) {
      this.setStatus(result.error, true);
      return;
    }
    this.opts.onImport(result.preset, name);
    this.setStatus(`«${name}» cargado. Ya suena.`);
    this.closePopup();
  }

  private setStatus(msg: string, isError = false): void {
    clearTimeout(this.statusTimer);
    this.status.textContent = msg;
    this.status.dataset.error = String(isError);
  }
}
