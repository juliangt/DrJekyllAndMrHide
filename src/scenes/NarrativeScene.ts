/**
 * NARRATIVE (SPEC §3, §4.1): escena GENÉRICA que renderiza los paneles de
 * `lore[]` del `LevelConfig` activo (texto ≤ 40 palabras por panel, fondo
 * procedural por viñeta, avance por tap, «Saltar»).
 *
 * PLACEHOLDER (Etapa 0): escena vacía; se implementa en la Etapa 3.
 */
import Phaser from 'phaser';

export class NarrativeScene extends Phaser.Scene {
  constructor() {
    super('NarrativeScene');
  }

  create(): void {}
}
