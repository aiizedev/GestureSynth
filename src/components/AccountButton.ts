/**
 * UI de cuenta (opcional) — entrar con Google / salir / nombre + avatar.
 *
 * Sigue el patrón de `ThemePicker`: importa su módulo (`../auth/auth`)
 * directamente, monta `element` en el constructor, `render()` centraliza
 * estado→DOM y `dispose()` corta la suscripción. Sin `tone`, sin Supabase
 * directo.
 *
 * Copia clave: la cuenta NO hace falta para crear ni tocar sonidos; solo sirve
 * para guardar los presets y llevarlos a cualquier dispositivo.
 *
 * Variantes:
 *  - `"full"`   → cabecera de `/`: botón + explicación larga, nombre visible,
 *    y el botón "Salir" (cerrar sesión SOLO se puede desde `/`).
 *  - `"compact"`→ columna de `/gesture`: solo indicador (avatar + nombre en el
 *    `title`); sin "Salir".
 */
import {
  cleanupAuthUrl,
  isAuthConfigured,
  onAuthChange,
  signIn,
  signOut,
  userFromSession,
  type AccountUser,
} from "../auth/auth";

type Variant = "full" | "compact";
type State = "loading" | "out" | "in";

const EXPLAINER_FULL =
  "Tocar y crear sonidos no necesita cuenta; sirve para guardar tus presets en la nube.";
const EXPLAINER_COMPACT = "para guardar tus presets en tu cuenta";

export class AccountButton {
  readonly element: HTMLDivElement;

  private readonly variant: Variant;
  private readonly onChange?: () => void;
  private readonly stop: () => void;

  private state: State = "loading";
  private user: AccountUser | null = null;

  constructor(variant: Variant = "full", onChange?: () => void) {
    this.variant = variant;
    this.onChange = onChange;

    this.element = document.createElement("div");
    this.element.className =
      variant === "compact" ? "account account-compact" : "account";

    // Sin Supabase configurado: la cuenta no existe, la app sigue entera.
    if (!isAuthConfigured) {
      this.element.hidden = true;
      this.stop = () => {};
      return;
    }

    this.render();
    this.stop = onAuthChange((session) => {
      this.user = userFromSession(session);
      this.state = this.user ? "in" : "out";
      this.render();
      this.onChange?.();
    });
    cleanupAuthUrl();
  }

  dispose(): void {
    this.stop();
  }

  private render(): void {
    this.element.replaceChildren();
    this.element.removeAttribute("title");

    if (this.state === "loading") {
      const dots = document.createElement("span");
      dots.className = "account-loading";
      dots.textContent = "…";
      this.element.append(dots);
      return;
    }

    if (this.state === "out") {
      this.element.append(
        this.button("Entrar con Google", () => void signIn("google")),
        this.explainer(
          this.variant === "compact" ? EXPLAINER_COMPACT : EXPLAINER_FULL,
        ),
      );
      return;
    }

    // state === "in"
    const u = this.user;
    if (!u) return;

    this.element.append(this.avatar(u));
    if (this.variant === "full") {
      const name = document.createElement("span");
      name.className = "account-name";
      name.textContent = u.name;
      this.element.append(name);
      // Cerrar sesión solo desde `/`.
      this.element.append(this.button("Salir", () => void signOut()));
    } else {
      this.element.title = u.email ? `${u.name} · ${u.email}` : u.name;
    }
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "account-btn";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  private explainer(text: string): HTMLSpanElement {
    const s = document.createElement("span");
    s.className = "account-explainer";
    s.textContent = text;
    return s;
  }

  private avatar(u: AccountUser): HTMLElement {
    if (u.avatarUrl) {
      const img = document.createElement("img");
      img.className = "account-avatar";
      img.src = u.avatarUrl;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.width = 22;
      img.height = 22;
      return img;
    }
    const dot = document.createElement("span");
    dot.className = "account-avatar account-avatar-initial";
    dot.textContent = (u.name.trim()[0] ?? "?").toUpperCase();
    return dot;
  }
}
