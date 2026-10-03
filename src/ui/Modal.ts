/**
 * Modal (SPEC §6/§10.2, PLAN Etapa 5): modal centrado del quiz — velo de
 * noche que separa la carta del fondo + panel pergamino (CLARO para el quiz:
 * «tipo pergamino/cartas antiguas», SPEC §6) + capa de contenido.
 *
 * Capa Phaser fina: el ESTILO y las posiciones vienen de los datos puros de
 * `gameplay/quizState.ts` (testeables); el marco lo dibuja `ui/Panel` con el
 * `PanelStyle` que recibe. El quiz nunca cierra el modal sin feedback (D5):
 * no hay ningún botón de cierre — las salidas son los botones de las fases
 * `feedback-wrong` / `story` del reducer puro.
 */
import type Phaser from 'phaser';
import { hexToNumber, type HexColor } from '../config/palette';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { Panel, type PanelStyle } from './Panel';

/** Config de construcción (todo menos la escena). */
export interface ModalOptions {
  /** Centro X de la carta (px). */
  centerX: number;
  /** Centro Y de la carta (px). */
  centerY: number;
  /** Ancho/alto de la carta (los calcula `quizBoardLayout` por vista). */
  width: number;
  height: number;
  /** Estilo del marco pergamino (claro para el quiz). */
  style: PanelStyle;
  /** Velo de fondo: oscurece la escena y aísla la carta. */
  veil: { color: HexColor; alpha: number };
  /** Profundidades explícitas: velo < panel < contenido. */
  depths: { veil: number; panel: number; content: number };
}

/**
 * Modal del quiz: velo + panel pergamino + `content` (contenedor en (0,0) —
 * los hijos usan coordenadas absolutas del lienzo). Cada fase del quiz crea
 * SU modal (alto por vista) y destruye el anterior.
 */
export class Modal {
  /** Capa de contenido: añade aquí textos, placas, tarjetas y botones. */
  readonly content: Phaser.GameObjects.Container;

  private readonly veil: Phaser.GameObjects.Rectangle;
  private readonly panel: Panel;
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: ModalOptions) {
    // Velo a tamaño del lienzo completo (centrado en la pantalla, no en la
    // carta): la carta «flota» sobre la escena apagada (SPEC §6).
    this.veil = scene.add
      .rectangle(
        BASE_WIDTH / 2,
        BASE_HEIGHT / 2,
        BASE_WIDTH,
        BASE_HEIGHT,
        hexToNumber(options.veil.color),
        options.veil.alpha,
      )
      .setDepth(options.depths.veil);

    // Panel ya se auto-registra en la escena (su constructor hace add.existing).
    this.panel = new Panel(scene, options.centerX, options.centerY, {
      width: options.width,
      height: options.height,
      style: options.style,
    }).setDepth(options.depths.panel);

    this.content = scene.add.container(0, 0).setDepth(options.depths.content);
  }

  /** Retira velo, marco y contenido (llamar al trocar de fase o apagar). */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.content.destroy();
    this.panel.destroy();
    this.veil.destroy();
  }
}
