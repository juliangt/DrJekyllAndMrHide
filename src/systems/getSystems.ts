/**
 * Acceso tipado a los sistemas del registry del juego (refactor menor de la
 * Etapa 2): `BootScene` deja SaveSystem/AudioSystem/ScoreSystem en
 * `game.registry` bajo claves de string; cualquier escena los recupera con
 * `getSystems(this)` en lugar de repetir strings y castear a mano.
 *
 * La lectura del registry es ESTRUCTURAL (`SystemsHost.registry.get`), así
 * que los tests usan un registry fake sin Phaser. Los tres sistemas son
 * clases Phaser-free → el `instanceof` es seguro también en jsdom.
 */

import { AudioSystem } from './AudioSystem';
import { SaveSystem } from './SaveSystem';
import { ScoreSystem } from './ScoreSystem';

/** Claves bajo las que BootScene registra los sistemas (documentadas ahí). */
export const SYSTEM_KEYS = {
  saveSystem: 'saveSystem',
  audioSystem: 'audioSystem',
  scoreSystem: 'scoreSystem',
} as const;

export type SystemKey = (typeof SYSTEM_KEYS)[keyof typeof SYSTEM_KEYS];

/** Contrato de lectura del registry (lo cumple `Phaser.Data.DataManager`). */
export interface RegistryLike {
  get(key: string): unknown;
}

/** Lo que posee un registry con sistemas (lo cumple `Phaser.Scene`). */
export interface SystemsHost {
  registry: RegistryLike;
}

/** La terna de sistemas listos para usar, ya tipada. */
export interface GameSystems {
  saveSystem: SaveSystem;
  audioSystem: AudioSystem;
  scoreSystem: ScoreSystem;
}

/** Recupera un sistema del registry validando tipo, o lanza con diagnóstico. */
function requireSystem<T>(
  host: SystemsHost,
  key: SystemKey,
  // `...args: any[]`: cada sistema tiene su propia firma de constructor.
  ctor: abstract new (...args: any[]) => T,
): T {
  const value = host.registry.get(key);
  if (!(value instanceof ctor)) {
    throw new Error(
      `getSystems: "${key}" no está en el registry o es de tipo incorrecto ` +
        `(¿se pasó por BootScene? encontrado: ${typeof value})`,
    );
  }
  return value;
}

/**
 * Los tres sistemas del juego desde el registry de la escena. Lanza (con
 * mensaje accionable) si BootScene no llegó a registrarlos — prefiero
 * fallar rápido en desarrollo a un `undefined` silencioso en producción.
 */
export function getSystems(host: SystemsHost): GameSystems {
  return {
    saveSystem: requireSystem(host, SYSTEM_KEYS.saveSystem, SaveSystem),
    audioSystem: requireSystem(host, SYSTEM_KEYS.audioSystem, AudioSystem),
    scoreSystem: requireSystem(host, SYSTEM_KEYS.scoreSystem, ScoreSystem),
  };
}
