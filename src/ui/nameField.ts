/**
 * Campo de NOMBRE para el diploma (PLAN Etapa 6, tarea 3): input de texto
 * DOM puntual posicionado sobre el canvas.
 *
 * DECISIÓN DE APPROACH (documentada): Phaser 4 ya no trae `TextInput`, y la
 * SPEC §10.1 («Sin React ni framework de DOM») no prohíbe un `<input>` HTML
 * aislado — es el approach estándar y más robusto para capturar texto en
 * Phaser (teclado físico + teclado móvil de confianza, acentos, maxlength).
 * Se descartó capturar `keydown` a mano: pierde IME/acentos, no abre el
 * teclado virtual en móvil y obliga a dibujar caret/selection a mano.
 *
 * Este módulo es PURO DOM (sin import de Phaser) para que los tests lo
 * ejerciten en jsdom:
 *
 *  - `canvasPointToCss`: mapea un punto del lienzo LÓGICO (720×1280) a px
 *    CSS del viewport, replicando la matemática de `Scale.FIT +
 *    CENTER_BOTH` (escala = mín de las dos razones + centrado con offsets).
 *    Con `Scale.FIT` el canvas SIEMPRE conserva el aspecto, así que los
 *    offsets dan 0 — se calculan igualmente para ser robustos a cambios de
 *    modo.
 *  - `NameField`: crea el `<input>`, lo posiciona sobre la zona de firma
 *    (re-leyendo `getBoundingClientRect()` del canvas en cada
 *    posicionado — también al redimensionar la ventana), y limpia TODO en
 *    `destroy()` (quita listeners y elemento del DOM): al cambiar de
 *    escena el input debe desaparecer — VictoryScene lo llama en SHUTDOWN.
 *
 * El input nace OCULTO: la escena lo muestra al tocar la zona de firma
 * (gesto real → el teclado virtual abre sin chocar con las políticas de
 * autoplay/focus de los navegadores) y lo oculta al confirmar.
 */

/** Rect CSS del canvas (lo que devuelve `getBoundingClientRect()`). */
export interface CanvasRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Un punto/tamaño en coords del lienzo lógico (720×1280). */
export interface GamePoint {
  x: number;
  y: number;
}

/** Posición CSS resultante + escala aplicada (para dimensionar el campo). */
export interface CssPlacement {
  /** Left en px de viewport (coordenadas client, para `position: fixed`). */
  left: number;
  /** Top en px de viewport. */
  top: number;
  /** Escala lienzo→CSS usada (mín de las razones, como Scale.FIT). */
  scale: number;
}

/**
 * Mapea el punto `point` (coords lógicas del juego) a px CSS dentro del
 * rect del canvas: `scale = min(rectW/baseW, rectH/baseH)` y el punto se
 * centra con los offsets de letterbox (0 con Scale.FIT, que conserva el
 * aspecto). Entradas no finitas o rect degenerado → escala 0 y sin NaN.
 */
export function canvasPointToCss(
  point: GamePoint,
  canvasRect: CanvasRectLike,
  baseWidth: number,
  baseHeight: number,
): CssPlacement {
  const safeRect = {
    left: Number.isFinite(canvasRect.left) ? canvasRect.left : 0,
    top: Number.isFinite(canvasRect.top) ? canvasRect.top : 0,
    width: Number.isFinite(canvasRect.width) ? canvasRect.width : 0,
    height: Number.isFinite(canvasRect.height) ? canvasRect.height : 0,
  };
  const scale =
    baseWidth > 0 && baseHeight > 0
      ? Math.min(safeRect.width / baseWidth, safeRect.height / baseHeight)
      : 0;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 0;
  // Letterbox de Scale.FIT + CENTER_BOTH: el juego queda centrado en el rect.
  const offsetX = (safeRect.width - baseWidth * safeScale) / 2;
  const offsetY = (safeRect.height - baseHeight * safeScale) / 2;
  return {
    left: safeRect.left + offsetX + point.x * safeScale,
    top: safeRect.top + offsetY + point.y * safeScale,
    scale: safeScale,
  };
}

/** Config de construcción (todo lo que no es el `Document`). */
export interface NameFieldOptions {
  /** Lee el rect CSS del canvas (se re-lee en cada posicionado/resize). */
  getCanvasRect: () => CanvasRectLike;
  /** Dimensiones lógicas del lienzo (720×1280). */
  baseWidth: number;
  baseHeight: number;
  /** Centro del campo en coords de juego (centro de la línea del nombre). */
  center: GamePoint;
  /** Ancho/alto del campo en px de juego. */
  width: number;
  height: number;
  fontFamily: string;
  /** Tamaño de fuente en px de juego (se escala a CSS). */
  fontSize: number;
  /** Tinta del texto (mismo color que el cuerpo del diploma). */
  color: string;
  /** Fondo OPACO: cubre la línea del diploma mientras se edita. */
  backgroundColor: string;
  placeholder?: string;
  maxLength?: number;
  /** Disparo continuo mientras se escribe (la escena guarda el valor). */
  onInput?: (value: string) => void;
  /** Confirmación: Enter o blur (la escena actualiza el diploma y oculta). */
  onCommit?: (value: string) => void;
}

/**
 * Input DOM de firma del diploma. Nace oculto (`display: none`); la escena
 * lo muestra con `show()` (que además le da focus dentro del gesto) y lo
 * oculta con `hide()` al confirmar. `destroy()` desengancha todo.
 */
export class NameField {
  /** El elemento real (para diagnóstico/tests). */
  readonly element: HTMLInputElement;

  private readonly doc: Document;
  private readonly options: NameFieldOptions;
  private readonly handleWindowResize = (): void => this.reposition();

  constructor(doc: Document, options: NameFieldOptions) {
    this.doc = doc;
    this.options = options;

    const input = doc.createElement('input');
    input.type = 'text';
    input.setAttribute('maxlength', String(options.maxLength ?? 20));
    if (options.placeholder) {
      input.placeholder = options.placeholder;
    }
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.enterKeyHint = 'done';
    input.style.position = 'fixed'; // coords client (getBoundingClientRect)
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.borderRadius = '6px';
    input.style.textAlign = 'center';
    input.style.padding = '0';
    input.style.margin = '0';
    input.style.transform = 'translate(-50%, -50%)'; // `center` es el CENTRO
    input.style.caretColor = options.color;
    input.style.display = 'none'; // nace oculto: show() lo despierta
    this.element = input;

    input.addEventListener('input', () => {
      this.options.onInput?.(input.value);
    });
    // Enter confirma: el blur dispara onCommit (una sola vía, sin dobles).
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    });
    input.addEventListener('blur', () => {
      this.options.onCommit?.(input.value);
    });

    // Scale.FIT reescala el canvas con la ventana: recolocar en resize.
    doc.defaultView?.addEventListener('resize', this.handleWindowResize);

    doc.body.appendChild(input);
    this.reposition();
  }

  /** Valor crudo del campo (la normalización la hace `sanitizeName`). */
  getValue(): string {
    return this.element.value;
  }

  setValue(value: string): void {
    this.element.value = value;
  }

  /** Muestra el campo sobre el canvas y le da focus (dentro del gesto). */
  show(): void {
    this.reposition();
    this.element.style.display = 'block';
    this.element.focus();
  }

  /** Oculta el campo (sin tocar el valor). */
  hide(): void {
    this.element.style.display = 'none';
    this.element.blur();
  }

  get isVisible(): boolean {
    return this.element.style.display !== 'none';
  }

  /**
   * Recalcula posición/tamaño/fuente desde el rect ACTUAL del canvas —
   * llamado al construir, en `show()` y en cada resize de la ventana.
   */
  reposition(): void {
    const rect = this.options.getCanvasRect();
    const placement = canvasPointToCss(
      this.options.center,
      rect,
      this.options.baseWidth,
      this.options.baseHeight,
    );
    const style = this.element.style;
    style.left = `${placement.left}px`;
    style.top = `${placement.top}px`;
    style.width = `${this.options.width * placement.scale}px`;
    style.height = `${this.options.height * placement.scale}px`;
    style.fontSize = `${this.options.fontSize * placement.scale}px`;
    style.fontFamily = this.options.fontFamily;
    style.color = this.options.color;
    style.backgroundColor = this.options.backgroundColor;
  }

  /**
   * Limpieza completa: baja el listener de resize y QUITA el elemento del
   * DOM (al cambiar de escena el input debe desaparecer). Idempotente.
   */
  destroy(): void {
    this.doc.defaultView?.removeEventListener('resize', this.handleWindowResize);
    this.element.remove();
  }
}
