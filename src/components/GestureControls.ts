/**
 * Ficha de controles de `/gesture` — pop-up con las posiciones de cada mano y
 * su función. Se abre al terminar el tutorial y con el botón "controles".
 * Sólo DOM: sin `tone`, sin `@mediapipe/tasks-vision`.
 */
export class GestureControls {
  readonly element: HTMLDivElement;

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.close();
  };

  constructor() {
    this.element = document.createElement("div");
    this.element.className = "gesture-controls";
    this.element.hidden = true;
    this.element.addEventListener("click", (e) => {
      if (e.target === this.element) this.close(); // click en el fondo
    });

    const card = document.createElement("div");
    card.className = "gc-card";
    card.innerHTML = `
      <button type="button" class="gc-close" aria-label="cerrar">&times;</button>
      <h2 class="gc-title">Controles</h2>
      <div class="gc-cols">
        <section class="gc-col">
          <h3>Mano izquierda<span>elige el acorde</span></h3>
          <ul>
            <li><b>1 a 5 dedos</b> — grados I a V</li>
            <li><b>índice + meñique</b> — grado VI</li>
            <li><b>índice + meñique + pulgar</b> — grado VII</li>
            <li><b>inclinar a la derecha</b> — acorde mayor</li>
            <li><b>inclinar a la izquierda</b> — acorde menor</li>
          </ul>
        </section>
        <section class="gc-col">
          <h3>Mano derecha<span>voicing y volumen</span></h3>
          <ul>
            <li><b>índice</b> — hace sonar el acorde (tríada)</li>
            <li><b>+ medio</b> — séptima (maj7 / m7)</li>
            <li><b>+ medio + anular</b> — séptima dominante (7)</li>
            <li><b>+ medio + anular + meñique</b> — aumentado / disminuido</li>
            <li><b>+ pulgar</b> — primera inversión</li>
            <li><b>subir / bajar la mano</b> — más / menos volumen y distorsión</li>
          </ul>
        </section>
      </div>
      <p class="gc-foot">Sin la mano derecha el acorde se muestra pero no suena.</p>
    `;
    card
      .querySelector<HTMLButtonElement>(".gc-close")!
      .addEventListener("click", () => this.close());
    this.element.append(card);
  }

  get isOpen(): boolean {
    return !this.element.hidden;
  }

  open(): void {
    if (this.isOpen) return;
    this.element.hidden = false;
    document.addEventListener("keydown", this.onKey);
  }

  close(): void {
    if (!this.isOpen) return;
    this.element.hidden = true;
    document.removeEventListener("keydown", this.onKey);
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }
}
