import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin, type Connect } from "vite";

const entry = (file: string) => fileURLToPath(new URL(file, import.meta.url));

/**
 * MPA: la app de audio vive en `/` (index.html) y la de identificación de manos
 * en `/gesture` (gesture.html). Este plugin sirve la URL limpia `/gesture`
 * (y `/gesture/`) como `gesture.html` en `vite dev` y en `vite preview`.
 *
 * En un hosting estático de producción hace falta la misma regla:
 * rewrite de `/gesture` → `/gesture.html`.
 */
function gestureRoute(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const path = (req.url ?? "").split("?")[0];
    if (path === "/gesture" || path === "/gesture/") {
      req.url = "/gesture.html" + (req.url ?? "").slice(path.length);
    }
    next();
  };
  return {
    name: "gesture-route",
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  plugins: [gestureRoute()],
  build: {
    rollupOptions: {
      input: {
        main: entry("./index.html"),
        gesture: entry("./gesture.html"),
      },
    },
  },
});
