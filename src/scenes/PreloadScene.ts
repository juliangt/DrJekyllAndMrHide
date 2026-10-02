/**
 * PRELOAD (SPEC §3): carga de las tipografías web (Google Fonts con
 * `FontFace.load` + timeout y fallback serif, SPEC §7.3) con una pantalla
 * mínima, y paso a MENU.
 *
 * PLACEHOLDER (Etapa 0): escena vacía; se implementa en la Etapa 1.
 */
import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  create(): void {}
}
