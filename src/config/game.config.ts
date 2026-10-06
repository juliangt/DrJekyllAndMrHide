/**
 * Configuración real de `Phaser.Game` (SPEC §9, §10.2): base 720×1280
 * (mobile-first vertical), `Scale.FIT` + `CENTER_BOTH` y fondo de noche de
 * la paleta. `src/main.ts` consume esta config (nada de config inline).
 *
 * Escenas registradas (SPEC §3 / §10.2): las 9 del flujo con archivo propio,
 * EN ORDEN de arranque. Las claves `SceneKey.GAME_OVER` y `SceneKey.EPILOGUE`
 * del flujo: la primera NO se registra aquí porque es un overlay dentro de
 * `ActionScene`; la segunda es la cinemática de cierre (`EpilogueScene`,
 * solo victoria final) y SÍ tiene archivo propio (ver `sceneKeys.ts`).
 *
 * `SceneKey` se define en `sceneKeys.ts` (módulo aparte, libre de Phaser y
 * del ciclo escenas↔config) y se re-exporta aquí por conveniencia.
 */
import Phaser from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH } from './dimensions';
import { nightBackground } from './palette';
import { ActionScene } from '../scenes/ActionScene';
import { BootScene } from '../scenes/BootScene';
import { EpilogueScene } from '../scenes/EpilogueScene';
import { IntroScene } from '../scenes/IntroScene';
import { MenuScene } from '../scenes/MenuScene';
import { NarrativeScene } from '../scenes/NarrativeScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { QuizScene } from '../scenes/QuizScene';
import { VictoryScene } from '../scenes/VictoryScene';

// Re-export del «enum» SceneKey (definido en sceneKeys.ts) por conveniencia.
// (Solo el valor: re-exportar además el TYPE homónimo choca con
// `verbatimModuleSyntax` — quien necesite el tipo importa de sceneKeys.)
export { SceneKey } from './sceneKeys';

/** Registro de escenas en orden del flujo BOOT → … → VICTORY → EPILOGUE (SPEC §3). */
export const SCENES: Phaser.Types.Scenes.SceneType[] = [
  BootScene, // SceneKey.BOOT
  PreloadScene, // SceneKey.PRELOAD
  MenuScene, // SceneKey.MENU
  IntroScene, // SceneKey.INTRO (cinemática pre-nivel: Jekyll → Hyde)
  NarrativeScene, // SceneKey.NARRATIVE
  ActionScene, // SceneKey.ACTION (contiene el overlay GAME_OVER)
  QuizScene, // SceneKey.QUIZ
  VictoryScene, // SceneKey.VICTORY (diploma)
  EpilogueScene, // SceneKey.EPILOGUE (cierre de la obra: solo victoria final)
];

/** Config completa de `new Phaser.Game(gameConfig)` (ver `src/main.ts`). */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: nightBackground,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: BASE_WIDTH,
    height: BASE_HEIGHT,
  },
  scene: SCENES,
};
