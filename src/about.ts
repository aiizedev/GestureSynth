import "./style.css";
import { ThemePicker } from "./components/ThemePicker";

/**
 * Entry de `/about` (3ª entrada de la MPA): página estática que explica qué es
 * GestureSynth, qué hace y cómo lo hace, con la estética de `/`. El "cómo lo
 * hace" enlaza a dos diagramas interactivos generados con archify
 * (`public/diagrams/*.html`, servidos como estáticos).
 *
 * Sin `tone`, sin `@mediapipe/tasks-vision`, sin Supabase: solo contenido +
 * el `ThemePicker` compartido (para que el acento coincida con el de `/`).
 */
const app = document.querySelector<HTMLDivElement>("#app")!;

// --- Cabecera (mirror de main.ts) ----------------------------------------
const header = document.createElement("header");
header.className = "site-head";

const brand = document.createElement("div");
brand.className = "head-brand";
const title = document.createElement("h1");
title.className = "site-title";
title.append("Estación", document.createElement("br"), "de sonido");
brand.append(title);

const actions = document.createElement("div");
actions.className = "head-actions";
const play = document.createElement("a");
play.className = "lets-play";
play.href = "/";
play.textContent = "Tocar →";
const themePicker = new ThemePicker();
actions.append(play, themePicker.element);

header.append(brand, actions);
app.append(header);

// --- Secciones ---------------------------------------------------------
function section(kicker: string, html: string): void {
  const s = document.createElement("section");
  s.className = "about-section";
  s.innerHTML = `<h2>${kicker}</h2>${html}`;
  app.append(s);
}

section(
  "Qué es",
  `
  <p class="about-lead">
    GestureSynth es un instrumento de acordes que vive entero en el navegador.
    Lo tocas con el ratón, sobre pads, o moviendo las manos frente a la cámara.
  </p>
  <p>
    Es 100&nbsp;% armónico: solo suena acordes, y la calidad del acorde —mayor,
    menor, séptima, dominante— es el centro de todo. La raíz se elige como
    <b>grado</b> (I a VII) dentro de una tonalidad, no como una nota suelta, así
    se piensa en términos musicales y se cambia de tonalidad al vuelo.
  </p>
  <p>
    El timbre se edita en caliente, con un motor sustractivo o de FM según el
    preset, y se guarda como JSON.
  </p>
`,
);

section(
  "Qué hace",
  `
  <p>Dos manos (o el ratón) reparten el trabajo:</p>
  <dl class="about-dl">
    <dt>Mano izquierda / pads</dt>
    <dd>
      El grado del acorde (I–VII) y su calidad: inclinar la mano a la izquierda
      lo hace menor; a la derecha, mayor.
    </dd>
    <dt>Mano derecha</dt>
    <dd>
      El voicing (1–8: tríada, séptima, dominante, quinta alterada y sus
      inversiones) y, por la altura, la dinámica: subir la mano sube el volumen
      y añade distorsión.
    </dd>
    <dt>Tonalidad</dt>
    <dd>
      12 tonalidades mayores y 12 menores. La nomenclatura sigue el círculo de
      quintas (F, B♭, E♭… con bemoles; el resto con sostenidos).
    </dd>
    <dt>Timbre</dt>
    <dd>
      23 presets de fábrica en tres grupos, más los que guardes. Cuatro macros
      (Brightness, Thickness, Space, Motion) y un bloque avanzado con todos los
      potenciómetros.
    </dd>
    <dt>Cuenta</dt>
    <dd>
      Opcional. Solo sirve para guardar tus presets en la nube y llevarlos a
      cualquier dispositivo; tocar y crear sonidos nunca la necesita.
    </dd>
  </dl>
`,
);

section(
  "Cómo lo hace",
  `
  <p>
    Una regla no negociable ordena el código: <code>tracking/</code> (lo que lee
    gestos) y <code>audio/</code> (lo que suena) no se conocen entre sí. El único
    puente es <code>makeGestureApplier</code>. Solo <code>Synth.ts</code> importa
    Tone.js; solo <code>HandLandmarker.ts</code> importa MediaPipe. El acorde que
    leen las manos entra al mismo <code>Synth</code> por el mismo puente que usa
    el panel de ratón.
  </p>
  <div class="about-grid">
    <a class="about-card" href="/diagrams/arquitectura.html?theme=dark" target="_blank" rel="noopener">
      <span class="about-card-title">Arquitectura del sistema</span>
      <span class="about-card-desc">
        Las dos formas de tocar, el puente común, y hacia dónde va el sonido
        (y la cuenta).
      </span>
      <span class="about-card-go">abrir diagrama ↗</span>
    </a>
    <a class="about-card" href="/diagrams/pipeline-manos.html?theme=dark" target="_blank" rel="noopener">
      <span class="about-card-title">Pipeline de manos (<code>/gesture</code>)</span>
      <span class="about-card-desc">
        Cámara → MediaPipe → grado + voicing → acorde estabilizado → síntesis,
        paso a paso.
      </span>
      <span class="about-card-go">abrir diagrama ↗</span>
    </a>
  </div>
`,
);

section(
  "Un poco de documentación",
  `
  <h3 class="about-sub">Tocar con la cámara</h3>
  <dl class="about-dl">
    <dt>Grado</dt>
    <dd>
      1 a 5 dedos de la mano izquierda = grados I a V. Índice + meñique = VI.
      Añade el pulgar = VII.
    </dd>
    <dt>Mayor / menor</dt>
    <dd>Inclina la mano izquierda: a la izquierda, menor; a la derecha, mayor; vertical, mayor.</dd>
    <dt>Voicing</dt>
    <dd>
      Mano derecha: índice = tríada; + corazón = séptima; + anular = dominante;
      los cuatro = aumentado / disminuido; + pulgar = primera inversión.
    </dd>
    <dt>Volumen</dt>
    <dd>Sube o baja la mano derecha (más arriba, más fuerte y con más distorsión).</dd>
  </dl>

  <h3 class="about-sub">Stack</h3>
  <p>
    Vite&nbsp;5 + TypeScript vanilla · Tone.js&nbsp;15 (<code>PolySynth</code>) ·
    <code>@mediapipe/tasks-vision</code>&nbsp;1 · Supabase (login Google +
    Postgres con RLS y Realtime) · Vitest&nbsp;2.
  </p>

  <h3 class="about-sub">En el repositorio</h3>
  <dl class="about-dl">
    <dt><code>audio/</code></dt>
    <dd>La síntesis. <code>Synth</code> es una caja opaca; nadie de fuera toca un nodo de Tone.</dd>
    <dt><code>tracking/</code></dt>
    <dd>Las fuentes de gesto. Módulos puros y testeados que leen dedos, grado, inclinación y voicing.</dd>
    <dt><code>utils/</code></dt>
    <dd>El puente (<code>makeGestureApplier</code>) y la teoría musical (grado + voicing → frecuencias).</dd>
    <dt><code>components/</code></dt>
    <dd>La interfaz: pads, panel de timbre, vista de cámara, tour, cuenta…</dd>
    <dt><code>auth/</code></dt>
    <dd>Login con Supabase y la sincronización de presets con la nube.</dd>
  </dl>
`,
);

// --- Pie -------------------------------------------------------------
const foot = document.createElement("footer");
foot.className = "about-foot";
foot.innerHTML = `
  <a href="/">← Tocar</a>
  <a href="/gesture">Cámara →</a>
  <span>Hecho con Vite · Tone.js · MediaPipe · Supabase.</span>
`;
app.append(foot);
