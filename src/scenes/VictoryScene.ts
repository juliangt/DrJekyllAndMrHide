/**
 * VICTORY (SPEC §3, §6): diploma procedural (marco pergamino + sello de cera)
 * con felicitación por haber leído la obra, desglose de puntaje
 * (taps + quiz + bonus), input opcional de nombre y botones de cierre.
 *
 * PLACEHOLDER: escena vacía; se implementa en la Etapa 6.
 */
import Phaser from 'phaser';
import { SceneKey } from '../config/sceneKeys';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.VICTORY);
  }

  create(): void {}
}
