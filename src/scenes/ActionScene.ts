/**
 * ACTION (SPEC §3, §4.2): escena GENÉRICA que ejecuta el `ActionConfig` del
 * nivel activo. Nivel 1: callejón con parallax de niebla y la niña como
 * objetivo errático; meta 3 taps, timer 45 s; timeout → GAME_OVER.
 *
 * PLACEHOLDER (Etapa 0): escena vacía; se implementa en la Etapa 4.
 */
import Phaser from 'phaser';

export class ActionScene extends Phaser.Scene {
  constructor() {
    super('ActionScene');
  }

  create(): void {}
}
