import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin, type Connect } from "vite";

const entry = (file: string) => fileURLToPath(new URL(file, import.meta.url));

/**
 * MPA: la app de audio vive en `/` (index.html), la de identificación de manos
 * en `/gesture` (gesture.html) y la página informativa en `/about` (about.html).
 * Este plugin sirve las URLs limpias `/<name>` (y `/<name>/`) como
 * `<name>.html` en `vite dev` y en `vite preview`.
 *
 * En un hosting estático de producción hace falta la misma regla
 * (ver `vercel.json`): rewrite de `/<name>` → `/<name>.html`.
 */
function cleanUrls(names: string[]): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const path = (req.url ?? "").split("?")[0];
    for (const name of names) {
      if (path === `/${name}` || path === `/${name}/`) {
        req.url = `/${name}.html` + (req.url ?? "").slice(path.length);
        break;
      }
    }
    next();
  };
  return {
    name: "clean-urls",
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  plugins: [cleanUrls(["gesture", "about"])],
  build: {
    rollupOptions: {
      input: {
        main: entry("./index.html"),
        gesture: entry("./gesture.html"),
        about: entry("./about.html"),
      },
    },
  },
});
