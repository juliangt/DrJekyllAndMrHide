/**
 * BOOT (SPEC §3): primer estado del flujo. En su versión final genera las
 * texturas procedurales (SPEC §7, D8), inicializa los sistemas
 * (save/audio/score) y pasa a PRELOAD.
 *
 * PLACEHOLDER (Etapa 0): por ahora solo fija el color base de fondo para
 * cumplir el criterio de aceptación de la Etapa 0 (canvas con pantalla de
 * color base). La escena real llega en la Etapa 1 — Fundaciones.
 */
import Phaser from 'phaser';
import { NIGHT_BACKGROUND } from '../config/palette';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    // Etapa 0: pantalla de color base (el fondo también viene en la config
    // del juego; se refuerza aquí para cuando la escena gane contenido).
    this.cameras.main.setBackgroundColor(NIGHT_BACKGROUND);
  }
}
