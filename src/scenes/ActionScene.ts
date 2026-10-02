/**
 * ACTION (SPEC §3, §4.2): escena GENÉRICA que ejecuta el `ActionConfig` del
 * nivel activo. Nivel 1: callejón con parallax de niebla y la niña como
 * objetivo errático; meta 3 taps, timer 45 s; timeout → GAME_OVER.
 *
 * NOTA: GAME_OVER (la 8ª clave del flujo, SPEC §3) es un OVERLAY dibujado
 * DENTRO de esta escena («La niebla lo ocultó todo… ¡inténtalo de nuevo!» +
 * «Reintentar»), no una escena con archivo propio (SPEC §10.2).
 *
 * PLACEHOLDER: escena vacía; se implementa en la Etapa 4.
 */
import Phaser from 'phaser';
import { SceneKey } from '../config/sceneKeys';

export class ActionScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.ACTION);
  }

  create(): void {}
}
