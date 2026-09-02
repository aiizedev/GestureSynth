/**
 * Copia los binarios wasm de `@mediapipe/tasks-vision` y descarga el modelo
 * `hand_landmarker.task` a `public/mediapipe/` para que `/gesture` funcione sin
 * depender de una CDN en runtime.
 *
 * Se ejecuta en `postinstall` y con `npm run setup:mediapipe`. Nunca falla el
 * build: si algo no está disponible, avisa y sigue (el modelo puede servirse
 * desde CDN pasando `modelAssetPath` a `HandLandmarkerSource`).
 */
import { access, cp, mkdir, writeFile } from "node:fs/promises";

const WASM_SRC = new URL(
  "../node_modules/@mediapipe/tasks-vision/wasm/",
  import.meta.url,
);
const DEST = new URL("../public/mediapipe/", import.meta.url);
const WASM_DEST = new URL("wasm/", DEST);
const MODEL_DEST = new URL("hand_landmarker.task", DEST);
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const exists = (url) =>
  access(url).then(
    () => true,
    () => false,
  );

async function copyWasm() {
  if (!(await exists(WASM_SRC))) {
    console.warn(
      "[mediapipe] wasm no encontrado en node_modules; ¿falta `npm install`?",
    );
    return;
  }
  if (await exists(new URL("vision_wasm_internal.wasm", WASM_DEST))) {
    console.log("[mediapipe] wasm ya presente en public/mediapipe/wasm");
    return;
  }
  await mkdir(WASM_DEST, { recursive: true });
  await cp(WASM_SRC, WASM_DEST, { recursive: true });
  console.log("[mediapipe] wasm copiado a public/mediapipe/wasm");
}

async function fetchModel() {
  if (await exists(MODEL_DEST)) {
    console.log("[mediapipe] hand_landmarker.task ya presente");
    return;
  }
  try {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await mkdir(DEST, { recursive: true });
    await writeFile(MODEL_DEST, Buffer.from(await res.arrayBuffer()));
    console.log("[mediapipe] hand_landmarker.task descargado");
  } catch (err) {
    console.warn(
      `[mediapipe] no se pudo descargar el modelo (${err.message}). ` +
        "Descárgalo a mano en public/mediapipe/hand_landmarker.task o " +
        "pasa una URL de CDN a HandLandmarkerSource.",
    );
  }
}

await mkdir(DEST, { recursive: true });
await copyWasm();
await fetchModel();
