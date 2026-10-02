/**
 * Etapa 2 — test del helper `getSystems` (`src/systems/getSystems.ts`):
 * acceso tipado a los sistemas del registry de Phaser con un registry FAKE
 * (estructura `{ get(key) }`), sin cargar Phaser. Cubre el caso feliz, los
 * faltantes y los tipos incorrectos (fail-fast con diagnóstico).
 */
import { describe, expect, it } from 'vitest';
import { SYSTEM_KEYS, getSystems, type RegistryLike } from '../systems/getSystems';
import { AudioSystem } from '../systems/AudioSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { ScoreSystem } from '../systems/ScoreSystem';

/** Registry fake: un mapa que se lee con get(key) como el de Phaser. */
class FakeRegistry implements RegistryLike {
  private readonly map = new Map<string, unknown>();
  set(key: string, value: unknown): void {
    this.map.set(key, value);
  }
  get(key: string): unknown {
    return this.map.get(key);
  }
}

/** Sistema reales (Phaser-free) montados con sus fakes inyectables. */
function makeRealSystems(): {
  saveSystem: SaveSystem;
  audioSystem: AudioSystem;
  scoreSystem: ScoreSystem;
} {
  const saveSystem = new SaveSystem();
  const audioSystem = new AudioSystem({
    saveSystem,
    createContext: (): never => {
      throw new Error('no debe crearse el contexto en estos tests');
    },
  });
  const scoreSystem = new ScoreSystem();
  return { saveSystem, audioSystem, scoreSystem };
}

function makeFullRegistry(): FakeRegistry {
  const systems = makeRealSystems();
  const registry = new FakeRegistry();
  registry.set(SYSTEM_KEYS.saveSystem, systems.saveSystem);
  registry.set(SYSTEM_KEYS.audioSystem, systems.audioSystem);
  registry.set(SYSTEM_KEYS.scoreSystem, systems.scoreSystem);
  return registry;
}

describe('SYSTEM_KEYS — las claves pactadas con BootScene', () => {
  it('son exactamente saveSystem / audioSystem / scoreSystem (los strings actuales)', () => {
    expect(SYSTEM_KEYS).toEqual({
      saveSystem: 'saveSystem',
      audioSystem: 'audioSystem',
      scoreSystem: 'scoreSystem',
    });
  });
});

describe('getSystems — caso feliz', () => {
  it('devuelve las tres instancias CORRECTAS desde un registry fake', () => {
    const systems = makeRealSystems();
    const registry = new FakeRegistry();
    registry.set(SYSTEM_KEYS.saveSystem, systems.saveSystem);
    registry.set(SYSTEM_KEYS.audioSystem, systems.audioSystem);
    registry.set(SYSTEM_KEYS.scoreSystem, systems.scoreSystem);

    const result = getSystems({ registry });

    expect(result.saveSystem).toBeInstanceOf(SaveSystem);
    expect(result.audioSystem).toBeInstanceOf(AudioSystem);
    expect(result.scoreSystem).toBeInstanceOf(ScoreSystem);
    expect(result.saveSystem).toBe(systems.saveSystem);
    expect(result.audioSystem).toBe(systems.audioSystem);
    expect(result.scoreSystem).toBe(systems.scoreSystem);
  });

  it('los sistemas devueltos están VIVOS (usan sus APIs normales)', () => {
    const result = getSystems({ registry: makeFullRegistry() });
    result.saveSystem.setInProgress(true);
    result.scoreSystem.add(10);
    result.audioSystem.setMuted(true);
    expect(result.saveSystem.inProgress).toBe(true);
    expect(result.scoreSystem.getScore()).toBe(10);
    expect(result.audioSystem.muted).toBe(true);
  });
});

describe('getSystems — fail-fast ante registry incompleto o corrupto', () => {
  it('registry vacío: lanza con mensaje accionable', () => {
    expect(() => getSystems({ registry: new FakeRegistry() })).toThrowError(/saveSystem/);
  });

  it('un sistema de tipo incorrecto bajo la clave correcta: lanza', () => {
    const registry = makeFullRegistry();
    registry.set(SYSTEM_KEYS.audioSystem, { no: 'soy un AudioSystem' });
    expect(() => getSystems({ registry })).toThrowError(/audioSystem/);
  });

  it('el mensaje menciona BootScene (diagnóstico del fallo)', () => {
    const registry = makeFullRegistry();
    registry.set(SYSTEM_KEYS.scoreSystem, 42);
    try {
      getSystems({ registry });
      expect.unreachable('debía lanzar');
    } catch (error) {
      expect((error as Error).message).toContain('BootScene');
    }
  });
});
