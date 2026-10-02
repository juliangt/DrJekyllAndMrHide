/**
 * MENU (SPEC §3, §6): splash gótico con título animado y niebla en deriva,
 * botones «Comenzar el viaje», «Cómo jugar» y «Continuar» (solo si hay
 * partida en curso), y toggle de mute.
 *
 * PLACEHOLDER: escena vacía; se implementa en la Etapa 2.
 */
import Phaser from 'phaser';
import { SceneKey } from '../config/sceneKeys';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.MENU);
  }

  create(): void {}
}
