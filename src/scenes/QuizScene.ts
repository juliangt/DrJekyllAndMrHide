/**
 * QUIZ (SPEC §3, §4.3): escena GENÉRICA que renderiza el `QuizConfig` del
 * nivel activo: modal pergamino, 4 tarjetas-opción (A–D), feedback pedagógico
 * siempre; fallo → reinicio del nivel completo (decisión D5).
 *
 * PLACEHOLDER: escena vacía; se implementa en la Etapa 5.
 */
import Phaser from 'phaser';
import { SceneKey } from '../config/sceneKeys';

export class QuizScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.QUIZ);
  }

  create(): void {}
}
