/**
 * Etapa 7 — QA de PERSISTENCIA de ciclo completo (PLAN tarea 4 / SPEC §11):
 * el recorrido entero del save a través de «recargas simuladas».
 *
 * Una recarga se simula con una NUEVA instancia de `SaveSystem` sobre el
 * MISMO storage (en producción: `localStorage` que sobrevive a la pestaña).
 * Verifica el flujo de vida entero:
 *
 *   partida nueva → comenzar (inProgress=true, checkpoint al N1) → recarga
 *   (estado intacto, «Continuar» visible) → timeout/reintento (no toca el
 *   save) → quiz fallido (D5: la tanda se descarta, el save sigue
 *   inProgress) → completar (markLevelComplete: récord + inProgress=false,
 *   «Continuar» desaparece) → recarga (récord y levelsCompleted intactos)
 *
 * más el flujo MULTI-NIVEL de la Fase 4 (checkpoint `currentLevel`:
 * avanzar de quiz lo mueve al siguiente nivel; «Continuar» reanuda SIN
 * intro; el fallo y el timeout no lo tocan) y los bordes: mute persistente
 * entre instancias, save corrupto a mitad (defaults sin romper, y el juego
 * sigue escribiendo después) y escritura que falla (cuota/modo privado: el
 * juego vive en memoria).
 *
 * El wiring con las escenas ya está cubierto por `menuButtonsFor`
 * (menu.test.ts) — aquí se ejercita ESE contrato de punta a punta.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SAVE,
  SAVE_KEY,
  SaveSystem,
  type StorageLike,
} from '../systems/SaveSystem';
import { beginJourney, menuButtonsFor } from '../config/menu';
import { SceneKey } from '../config/sceneKeys';
import { AudioSystem } from '../systems/AudioSystem';
import { ScoreSystem } from '../systems/ScoreSystem';

/** Storage fake en memoria: es lo que «sobrevive a la recarga». */
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

describe('ciclo de vida completo del save (recargas simuladas)', () => {
  it('comenzar → recarga conserva inProgress → completar → recarga limpia inProgress y guarda récord', () => {
    const storage = new FakeStorage();

    // 1. Partida nueva: sin «Continuar».
    const session1 = new SaveSystem(storage);
    expect(session1.inProgress).toBe(false);
    expect(menuButtonsFor(session1.getData()).some((b) => b.id === 'continue')).toBe(false);

    // 2. «Comenzar el viaje» marca la partida en curso (SPEC §11).
    beginJourney(session1);
    expect(session1.inProgress).toBe(true);

    // 3. RELOAD: nueva instancia sobre el mismo storage.
    const session2 = new SaveSystem(storage);
    expect(session2.inProgress).toBe(true);
    expect(menuButtonsFor(session2.getData()).some((b) => b.id === 'continue')).toBe(true);

    // 4. Timeout del minijuego + «Reintentar»: SOLO el minijuego — el save
    //    no cambia (D6). El score de tanda se descarta fuera del save.
    const score = new ScoreSystem();
    score.add(20);
    score.reset();
    expect(new SaveSystem(storage).inProgress).toBe(true);

    // 5. Quiz fallido (D5): reinicio del NIVEL — descarta la tanda, el save
    //    MANTIENE inProgress (re-marcar es idempotente, como hace QuizScene).
    score.add(100);
    session2.setInProgress(true);
    score.reset();
    const session3 = new SaveSystem(storage);
    expect(session3.inProgress).toBe(true);
    expect(menuButtonsFor(session3.getData()).some((b) => b.id === 'continue')).toBe(true);

    // 6. Quiz correcto → VICTORY: markLevelComplete guarda récord y cierra.
    score.add(10, 'taps');
    score.add(40, 'timeBonus');
    score.add(100, 'quiz');
    const previousRecord = session3.lastScore; // ANTES de marcar (rótulo récord)
    session3.markLevelComplete(score.getScore());
    expect(previousRecord).toBe(0);
    expect(session3.inProgress).toBe(false);
    expect(session3.lastScore).toBe(150);
    expect(session3.levelsCompleted).toBe(1);

    // 7. RELOAD final: todo el cierre persiste y «Continuar» desaparece.
    const session4 = new SaveSystem(storage);
    expect(session4.inProgress).toBe(false);
    expect(session4.lastScore).toBe(150);
    expect(session4.levelsCompleted).toBe(1);
    expect(menuButtonsFor(session4.getData()).some((b) => b.id === 'continue')).toBe(false);
  });

  it('la partida interrumpida en CUALQUIER estado reanuda (inProgress sobrevive siempre)', () => {
    // El PLAN pide «matar pestaña en cada estado»: en v1 el checkpoint es
    // el propio nivel (inProgress), así que interrumpir en narrativa,
    // acción o quiz deja el mismo save reanudable.
    const storage = new FakeStorage();
    const live = new SaveSystem(storage);
    beginJourney(live);

    for (const stage of ['Narrative', 'Action', 'Quiz']) {
      const reloaded = new SaveSystem(storage);
      expect(reloaded.inProgress, `tras matar la pestaña en ${stage}`).toBe(true);
      expect(reloaded.levelsCompleted).toBe(0);
    }
  });

  it('«Jugar de nuevo» tras ganar conserva el récord y permite un récord nuevo', () => {
    const storage = new FakeStorage();
    const first = new SaveSystem(storage);
    first.markLevelComplete(150);
    expect(first.lastScore).toBe(150);

    // Rejugar: nueva tanda en 0 y… peor suerte esta vez.
    const second = new SaveSystem(storage);
    second.markLevelComplete(90);
    expect(second.lastScore).toBe(150); // el récord NUNCA baja
    expect(second.levelsCompleted).toBe(1);

    // …y mejor: nuevo récord.
    const third = new SaveSystem(storage);
    third.markLevelComplete(214); // máximo teórico del Nivel 1 (SPEC §5)
    expect(third.lastScore).toBe(214);
  });
});

describe('flujo multi-nivel — continuar reanuda el nivel guardado (Fase 4)', () => {
  it('comenzar (checkpoint 1) → acertar quiz N1 (checkpoint 2) → recarga → «Continuar» reanuda el N2 SIN intro', () => {
    const storage = new FakeStorage();

    // 1. «Comenzar el viaje» (beginJourney): inProgress + checkpoint al N1.
    const session1 = new SaveSystem(storage);
    beginJourney(session1);
    expect(session1.currentLevel).toBe(1);

    // 2. Quiz correcto del N1 (lo que hace QuizScene.exitAfterCorrect):
    //    registra el nivel SIGUIENTE como checkpoint antes de transicionar.
    session1.setCurrentLevel(2);

    // 3. RELOAD: el checkpoint sobrevive y «Continuar» apunta a NARRATIVE
    //    (sin intro) — MenuScene pasará {levelId: currentLevel}.
    const session2 = new SaveSystem(storage);
    expect(session2.inProgress).toBe(true);
    expect(session2.currentLevel).toBe(2);
    const continueButton = menuButtonsFor(session2.getData()).find(
      (b) => b.id === 'continue',
    );
    expect(continueButton?.target).toBe(SceneKey.NARRATIVE);

    // 4. Quiz correcto del N2 → checkpoint 3; luego el N3 se completa
    //    (markLevelComplete con el id REAL de VictoryScene) y cierra.
    session2.setCurrentLevel(3);
    const score = new ScoreSystem();
    score.add(30, 'taps');
    score.add(100, 'quiz');
    score.add(84, 'timeBonus');
    session2.markLevelComplete(score.getScore(), 3);

    // 5. RELOAD final: obra completada — sin «Continuar» y arco cerrado.
    const session3 = new SaveSystem(storage);
    expect(session3.inProgress).toBe(false);
    expect(session3.levelsCompleted).toBe(3);
    expect(session3.lastScore).toBe(214);
    expect(menuButtonsFor(session3.getData()).some((b) => b.id === 'continue')).toBe(false);
  });

  it('quiz fallido (D5) y timeout NO mueven el checkpoint: la tanda se reanuda en el MISMO nivel', () => {
    const storage = new FakeStorage();
    const save = new SaveSystem(storage);
    beginJourney(save);
    save.setCurrentLevel(2);

    // Quiz fallido → restartLevel(): setInProgress(true), sin setCurrentLevel.
    save.setInProgress(true);
    // Timeout → «Reintentar»: ni siquiera toca el save (D6, probado arriba).
    const reloaded = new SaveSystem(storage);
    expect(reloaded.currentLevel).toBe(2);
    expect(reloaded.inProgress).toBe(true);
  });

  it('«Jugar de nuevo» tras la victoria re-abre el NIVEL 1 (checkpoint reiniciado) y conserva el récord', () => {
    const storage = new FakeStorage();
    const save = new SaveSystem(storage);
    save.setCurrentLevel(3);
    save.markLevelComplete(214, 3);
    expect(save.currentLevel).toBe(3);

    // Lo que hace VictoryScene.onPlayAgain(): checkpoint a 1 + tanda nueva.
    save.setCurrentLevel(1);
    const reloaded = new SaveSystem(storage);
    expect(reloaded.currentLevel).toBe(1);
    expect(reloaded.lastScore).toBe(214); // el récord NUNCA baja
  });
});

describe('mute persistente entre instancias (SPEC §8/§11)', () => {
  it('toggle de mute → nueva instancia lo lee y lo conserva', () => {
    const storage = new FakeStorage();
    const save = new SaveSystem(storage);
    const audio = new AudioSystem({ saveSystem: save, createContext: () => {
      throw new Error('no debe crear contexto en este test');
    } });
    expect(audio.muted).toBe(false);
    expect(audio.toggleMute()).toBe(true);

    const reloadedSave = new SaveSystem(storage);
    const reloadedAudio = new AudioSystem({ saveSystem: reloadedSave, createContext: () => {
      throw new Error('no debe crear contexto en este test');
    } });
    expect(reloadedAudio.muted).toBe(true);
  });

  it('el mute convive con el resto de campos del save (merge, no pisón)', () => {
    const storage = new FakeStorage();
    const save = new SaveSystem(storage);
    beginJourney(save);
    save.setMuted(true);
    save.markLevelComplete(120);

    const reloaded = new SaveSystem(storage);
    expect(reloaded.muted).toBe(true);
    expect(reloaded.inProgress).toBe(false);
    expect(reloaded.lastScore).toBe(120);
    expect(reloaded.levelsCompleted).toBe(1);
  });
});

describe('save corrupto a mitad de partida — defaults sin romper (SPEC §11)', () => {
  it('recarga con el storage envenenado → defaults y el juego SIGUE escribiendo', () => {
    const storage = new FakeStorage();
    const live = new SaveSystem(storage);
    beginJourney(live);
    live.setMuted(true);
    expect(storage.map.get(SAVE_KEY)).toBeDefined();

    // «Corrupción»: la entrada queda inservible (JSON roto a mitad).
    storage.setItem(SAVE_KEY, '{"levelsCompleted":0,"lastSc');

    const reloaded = new SaveSystem(storage);
    expect(reloaded.getData()).toEqual({ ...DEFAULT_SAVE });
    expect(reloaded.inProgress).toBe(false);

    // Y el ciclo continúa sin errores: comenzar + completar re-escribe.
    beginJourney(reloaded);
    reloaded.markLevelComplete(80);
    const after = new SaveSystem(storage);
    expect(after.inProgress).toBe(false);
    expect(after.lastScore).toBe(80);
    expect(after.levelsCompleted).toBe(1);
  });

  it('JSON válido pero con UN campo corrupto: ese campo cae al default, el resto sobrevive', () => {
    const storage = new FakeStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        levelsCompleted: 'uno',
        lastScore: 150,
        muted: 'sí',
        inProgress: true,
        currentLevel: 'tres',
      }),
    );
    const reloaded = new SaveSystem(storage);
    expect(reloaded.levelsCompleted).toBe(0); // corrupto → default
    expect(reloaded.lastScore).toBe(150); // intacto
    expect(reloaded.muted).toBe(false); // corrupto → default
    expect(reloaded.inProgress).toBe(true); // intacto
    expect(reloaded.currentLevel).toBe(1); // corrupto → default (checkpoint 1)
  });

  it('setItem que FALLA (cuota/modo privado): el juego sigue con el estado en memoria', () => {
    const storage = new ThrowingStorage();
    const save = new SaveSystem(storage);
    expect(() => {
      beginJourney(save);
      save.setMuted(true);
      save.markLevelComplete(64);
    }).not.toThrow();
    // En memoria el estado avanzó; en disco sigue vacío (recarga = defaults).
    expect(save.inProgress).toBe(false);
    expect(save.lastScore).toBe(64);
    expect(save.muted).toBe(true);
    expect(new SaveSystem(new FakeStorage()).getData()).toEqual({ ...DEFAULT_SAVE });
  });

  it('clear() vuelve a defaults y la siguiente recarga también arranca limpia', () => {
    const storage = new FakeStorage();
    const save = new SaveSystem(storage);
    save.markLevelComplete(200);
    save.setMuted(true);
    save.clear();

    expect(save.getData()).toEqual({ ...DEFAULT_SAVE });
    expect(new SaveSystem(storage).getData()).toEqual({ ...DEFAULT_SAVE });
    expect(storage.map.get(SAVE_KEY)).toBeUndefined();
  });
});
