/**
 * NARRATIVE (SPEC §3, §4.1): escena GENÉRICA que renderiza los paneles de
 * `lore[]` del `LevelConfig` activo (texto ≤ 40 palabras por panel, fondo
 * procedural por viñeta, avance por tap, «Saltar»).
 *
 * PLACEHOLDER: escena vacía; se implementa en la Etapa 3.
 */
import Phaser from 'phaser';
import { SceneKey } from '../config/sceneKeys';

export class NarrativeScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.NARRATIVE);
  }

  create(): void {}
}
