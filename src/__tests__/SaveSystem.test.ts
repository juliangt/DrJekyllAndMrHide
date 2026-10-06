/**
 * Etapa 1 — test del SaveSystem (SPEC §11): defaults sin save, roundtrip,
 * JSON corrupto → defaults, campos con tipo incorrecto → sanitizado campo
 * a campo, persistencia de mute y récord en markLevelComplete.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SAVE,
  SAVE_KEY,
  SaveSystem,
  type StorageLike,
} from '../systems/SaveSystem';

/** Storage fake inyectado (además del localStorage de jsdom). */
class FakeStorage implements StorageLike {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** Storage cuyo setItem siempre falla (cuota agotada / modo privado). */
class ThrowingStorage extends FakeStorage {
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

function seed(storage: StorageLike, value: string): void {
  storage.setItem(SAVE_KEY, value);
}

describe('SaveSystem — load con defaults', () => {
  it('sin save previo devuelve los defaults', () => {
    const system = new SaveSystem(new FakeStorage());
    expect(system.getData()).toEqual({ ...DEFAULT_SAVE });
    expect(system.levelsCompleted).toBe(0);
    expect(system.lastScore).toBe(0);
    expect(system.muted).toBe(false);
    expect(system.inProgress).toBe(false);
    expect(system.currentLevel).toBe(1);
  });

  it('defaults son una partida limpia con sonido, arrancando en el N1', () => {
    expect(DEFAULT_SAVE).toEqual({
      levelsCompleted: 0,
      lastScore: 0,
      muted: false,
      inProgress: false,
      currentLevel: 1,
    });
  });
});

describe('SaveSystem — roundtrip', () => {
  it('save persiste el merge y una nueva instancia lo lee', () => {
    const storage = new FakeStorage();
    const system = new SaveSystem(storage);
    system.save({ muted: true, lastScore: 214, levelsCompleted: 1, inProgress: true, currentLevel: 2 });

    const persisted = storage.map.get(SAVE_KEY);
    expect(persisted).toBeDefined();
    expect(JSON.parse(persisted as string)).toEqual({
      levelsCompleted: 1,
      lastScore: 214,
      muted: true,
      inProgress: true,
      currentLevel: 2,
    });

    const reloaded = new SaveSystem(storage);
    expect(reloaded.muted).toBe(true);
    expect(reloaded.lastScore).toBe(214);
    expect(reloaded.levelsCompleted).toBe(1);
    expect(reloaded.inProgress).toBe(true);
    expect(reloaded.currentLevel).toBe(2);
  });

  it('save hace MERGE (no pisa los campos no enviados)', () => {
    const system = new SaveSystem(new FakeStorage());
    system.save({ lastScore: 100 });
    system.save({ muted: true });
    expect(system.lastScore).toBe(100);
    expect(system.muted).toBe(true);
  });

  it('save devuelve el estado resultante (copia defensiva)', () => {
    const system = new SaveSystem(new FakeStorage());
    const snapshot = system.save({ lastScore: 50 });
    expect(snapshot.lastScore).toBe(50);
    snapshot.lastScore = 9999;
    expect(system.lastScore).toBe(50);
  });
});

describe('SaveSystem — save corrupto o esquema inválido', () => {
  it.each([
    ['JSON roto', '{oops'],
    ['string vacío', ''],
    ['JSON null', 'null'],
    ['string JSON', '"jekyll"'],
    ['array JSON', '[1,2,3]'],
    ['número JSON', '42'],
  ])('%s → defaults completos', (_name, poisoned) => {
    const storage = new FakeStorage();
    seed(storage, poisoned);
    const system = new SaveSystem(storage);
    expect(system.getData()).toEqual({ ...DEFAULT_SAVE });
  });

  it('campos con tipo incorrecto → default de ESE campo, el resto se conserva', () => {
    const storage = new FakeStorage();
    seed(
      storage,
      JSON.stringify({
        levelsCompleted: 'one',
        lastScore: true,
        muted: 'yes',
        inProgress: 1,
        currentLevel: 0, // fuera de rango (base 1) → default
      }),
    );
    const system = new SaveSystem(storage);
    expect(system.levelsCompleted).toBe(0);
    expect(system.lastScore).toBe(0);
    expect(system.muted).toBe(false);
    expect(system.inProgress).toBe(false);
    expect(system.currentLevel).toBe(1);
  });

  it('un campo válido sobrevive aunque otro esté corrupto (sanitiza campo a campo)', () => {
    const storage = new FakeStorage();
    seed(
      storage,
      JSON.stringify({ levelsCompleted: 1, lastScore: 214, muted: 42, inProgress: true, currentLevel: 3 }),
    );
    const system = new SaveSystem(storage);
    expect(system.levelsCompleted).toBe(1);
    expect(system.lastScore).toBe(214);
    expect(system.muted).toBe(false); // solo este cae al default
    expect(system.inProgress).toBe(true);
    expect(system.currentLevel).toBe(3); // intacto
  });

  it('números no enteros o negativos no son puntajes válidos → default', () => {
    const storage = new FakeStorage();
    seed(storage, JSON.stringify({ levelsCompleted: -1, lastScore: 12.5, muted: false, inProgress: false }));
    const system = new SaveSystem(storage);
    expect(system.levelsCompleted).toBe(0);
    expect(system.lastScore).toBe(0);
  });
});

describe('SaveSystem — setters tipados', () => {
  it('setMuted persiste (SPEC: se guarda al togglear)', () => {
    const storage = new FakeStorage();
    const system = new SaveSystem(storage);
    system.setMuted(true);
    expect(system.muted).toBe(true);
    expect(new SaveSystem(storage).muted).toBe(true);
  });

  it('setInProgress habilita «Continuar»', () => {
    const system = new SaveSystem(new FakeStorage());
    expect(system.inProgress).toBe(false);
    system.setInProgress(true);
    expect(system.inProgress).toBe(true);
  });

  it('markLevelComplete: nivel 1, récord y limpia inProgress', () => {
    const system = new SaveSystem(new FakeStorage());
    system.setInProgress(true);
    system.markLevelComplete(214);
    expect(system.levelsCompleted).toBe(1);
    expect(system.lastScore).toBe(214);
    expect(system.inProgress).toBe(false);
  });

  it('markLevelComplete conserva el MÁXIMO como récord', () => {
    const system = new SaveSystem(new FakeStorage());
    system.markLevelComplete(214);
    system.markLevelComplete(90); // segunda partida peor
    expect(system.lastScore).toBe(214);
  });

  it('clear vuelve a los defaults y borra la clave', () => {
    const storage = new FakeStorage();
    const system = new SaveSystem(storage);
    system.save({ lastScore: 214, muted: true });
    system.clear();
    expect(system.getData()).toEqual({ ...DEFAULT_SAVE });
    expect(storage.map.has(SAVE_KEY)).toBe(false);
  });
});

describe('SaveSystem — currentLevel, el checkpoint multi-nivel (Fase 4)', () => {
  it('setCurrentLevel persiste (nueva instancia sobre el mismo storage lo lee)', () => {
    const storage = new FakeStorage();
    const system = new SaveSystem(storage);
    system.setCurrentLevel(2);
    expect(system.currentLevel).toBe(2);
    expect(new SaveSystem(storage).currentLevel).toBe(2);

    system.setCurrentLevel(3);
    expect(new SaveSystem(storage).currentLevel).toBe(3);
  });

  it('valores basura caen al default 1 (sanitización del setter y del load)', () => {
    const storage = new FakeStorage();
    const system = new SaveSystem(storage);
    system.setCurrentLevel(0);
    expect(system.currentLevel).toBe(1);
    system.setCurrentLevel(-2);
    expect(system.currentLevel).toBe(1);
    system.setCurrentLevel(2.9); // se redondea a bajo (2) antes de sanitizar
    expect(system.currentLevel).toBe(2);
    system.setCurrentLevel(Number.NaN);
    expect(system.currentLevel).toBe(1);
  });

  it('un save VIEJO sin el campo currentLevel carga bien (esquema retrocompatible)', () => {
    const storage = new FakeStorage();
    seed(
      storage,
      JSON.stringify({ levelsCompleted: 1, lastScore: 214, muted: false, inProgress: true }),
    );
    const system = new SaveSystem(storage);
    expect(system.inProgress).toBe(true);
    expect(system.currentLevel).toBe(1); // default del campo nuevo
    // Y al escribir, el campo nuevo se agrega sin romper los viejos.
    system.setCurrentLevel(2);
    expect(JSON.parse(storage.map.get(SAVE_KEY) as string)).toMatchObject({
      levelsCompleted: 1,
      lastScore: 214,
      inProgress: true,
      currentLevel: 2,
    });
  });

  it('markLevelComplete NO toca el checkpoint (lo relevante es inProgress=false)', () => {
    const storage = new FakeStorage();
    const system = new SaveSystem(storage);
    system.setCurrentLevel(3);
    system.markLevelComplete(214, 3);
    expect(system.inProgress).toBe(false);
    expect(system.levelsCompleted).toBe(3);
    expect(system.currentLevel).toBe(3); // queda congelado pero ignorable
  });

  it('el quiz FALLADO (D5) no mueve el checkpoint: setInProgress no lo altera', () => {
    const storage = new FakeStorage();
    const system = new SaveSystem(storage);
    system.setCurrentLevel(2);
    system.setInProgress(true); // lo que hace QuizScene.restartLevel()
    expect(system.currentLevel).toBe(2); // reinicio del MISMO nivel
  });
});

describe('SaveSystem — robustez del storage', () => {
  it('un storage que lanza al escribir no rompe el juego (estado en memoria)', () => {
    const system = new SaveSystem(new ThrowingStorage());
    expect(() => system.save({ muted: true })).not.toThrow();
    expect(system.muted).toBe(true); // en memoria sigue válido
  });

  it('usa la clave única jekyll_hyde_save_v1 (SPEC §11)', () => {
    expect(SAVE_KEY).toBe('jekyll_hyde_save_v1');
  });
});

describe('SaveSystem — storage por defecto (localStorage de jsdom)', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('sin storage inyectado usa localStorage y persiste', () => {
    window.localStorage.clear();
    const system = new SaveSystem();
    expect(system.getData()).toEqual({ ...DEFAULT_SAVE });
    system.setMuted(true);
    expect(window.localStorage.getItem(SAVE_KEY)).toContain('"muted":true');
    expect(new SaveSystem().muted).toBe(true);
  });
});
