/**
 * Conecta la sesión (auth) con el almacén de presets (`userStore`) y la nube
 * (`presetsRemote`):
 *  - al iniciar sesión: fusiona nube + local (last-write-wins), sube lo que solo
 *    esté en local, y enciende las escrituras remotas + Realtime.
 *  - al cerrar sesión: apaga todo y se queda con la cache local.
 *
 * `initPresetSync()` se llama una vez por página (`main.ts` y `gesture.ts`).
 */
import { onAuthChange } from "./auth";
import {
  deleteRemote,
  listRemote,
  subscribeRemote,
  upsertRemote,
} from "./presetsRemote";
import { mergeRemote, setPresetRemote } from "../audio/presets/userStore";

let started = false;
let unsubAuth: (() => void) | null = null;
let unsubRealtime: (() => void) | null = null;
let syncing = false;

/** Trae la nube, fusiona, y sube lo local que falte o sea más nuevo. */
async function pullMergePush(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const { toPush } = mergeRemote(await listRemote());
    if (toPush.length > 0) {
      await Promise.all(toPush.map((p) => upsertRemote(p.name, p.preset)));
      // Segundo merge: recoge los `updated_at` que acaba de poner el servidor.
      mergeRemote(await listRemote());
    }
  } finally {
    syncing = false;
  }
}

/** Idempotente: llamar una vez por página. */
export function initPresetSync(): void {
  if (started) return;
  started = true;
  unsubAuth = onAuthChange((session) => {
    if (session) {
      setPresetRemote({
        upsert: (name, preset) => void upsertRemote(name, preset),
        remove: (name) => void deleteRemote(name),
      });
      void pullMergePush();
      unsubRealtime?.();
      unsubRealtime = subscribeRemote(() => void pullMergePush());
    } else {
      setPresetRemote(null);
      unsubRealtime?.();
      unsubRealtime = null;
    }
  });
}

/** Para tests: deshace `initPresetSync`. */
export function stopPresetSync(): void {
  unsubAuth?.();
  unsubRealtime?.();
  unsubAuth = null;
  unsubRealtime = null;
  started = false;
  syncing = false;
  setPresetRemote(null);
}
