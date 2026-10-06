/**
 * Etapa 2 — test de los DATOS del menú (`src/config/menu.ts`):
 * `menuButtonsFor` (Continuar visible si y sólo si inProgress, SPEC §11),
 * `beginJourney` (marcar inProgress al comenzar nivel), los textos del
 * titular y los 3 pasos del «Cómo jugar» (SPEC §6/§9).
 *
 * Fase 5 (v1.1) — «Continuar» TAMBIÉN pasa por la INTRO (la cinemática abre
 * TODA sesión): se valida el `target` de los descriptores y el wiring de
 * MenuScene LEYENDO EL FUENTE (patrón de los tests de IntroScene: jsdom no
 * puede cargar Phaser) — la rama Continue navega a INTRO con el nivel
 * guardado y NO llama `beginJourney` (eso es solo de partida nueva).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HOW_TO_PLAY,
  HOW_TO_PLAY_CLOSE_LABEL,
  HOW_TO_PLAY_MAX_WORDS,
  HOW_TO_PLAY_TITLE,
  MENU_SUBTITLE,
  MENU_TITLE,
  MenuButtonId,
  beginJourney,
  menuButtonsFor,
  type MenuButtonDescriptor,
} from '../config/menu';
import { SceneKey } from '../config/sceneKeys';
import { SaveSystem, type StorageLike } from '../systems/SaveSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { TEXTURE_KEYS } from '../art/textures';

/** Storage fake en memoria (el mismo patrón de los tests de SaveSystem). */
class FakeStorage implements StorageLike {
  private readonly map = new Map<string, string>();
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

describe('menuButtonsFor — qué botones mostrar (SPEC §6/§11)', () => {
  it('sin partida en curso: «Comenzar el viaje» y «Cómo jugar» (sin «Continuar»)', () => {
    const buttons = menuButtonsFor({ inProgress: false });
    expect(buttons.map((b) => b.id)).toEqual([MenuButtonId.Start, MenuButtonId.HowToPlay]);
    expect(buttons.some((b) => b.id === MenuButtonId.Continue)).toBe(false);
  });

  it('con inProgress: aparece «Continuar» además de los dos fijos', () => {
    const buttons = menuButtonsFor({ inProgress: true });
    expect(buttons.map((b) => b.id)).toEqual([
      MenuButtonId.Start,
      MenuButtonId.HowToPlay,
      MenuButtonId.Continue,
    ]);
  });

  it('«Continuar» aparece SI Y SOLO SI inProgress (tabla de verdad)', () => {
    for (const inProgress of [false, true]) {
      const hasContinue = menuButtonsFor({ inProgress }).some(
        (b) => b.id === MenuButtonId.Continue,
      );
      expect(hasContinue, `inProgress=${inProgress}`).toBe(inProgress);
    }
  });

  it('etiquetas exactas del SPEC §6', () => {
    const buttons = menuButtonsFor({ inProgress: true });
    const labels = buttons.map((b) => b.label);
    expect(labels).toEqual(['Comenzar el viaje', 'Cómo jugar', 'Continuar']);
  });

  it('«Comenzar» y «Continuar» navegan AMBOS a INTRO (la cinemática abre toda sesión); «Cómo jugar» no navega', () => {
    const buttons = menuButtonsFor({ inProgress: true });
    const byId = new Map(buttons.map((b) => [b.id, b]));
    expect(byId.get(MenuButtonId.Start)?.target).toBe(SceneKey.INTRO);
    // Fase 5 (v1.1): reanudar TAMBIÉN pasa por la intro — el nivel de destino
    // lo pasa MenuScene desde save.currentLevel (el descriptor es el dato; el
    // payload, la escena; la intro lo reenvía a NARRATIVE al cerrar).
    expect(byId.get(MenuButtonId.Continue)?.target).toBe(SceneKey.INTRO);
    expect(byId.get(MenuButtonId.HowToPlay)?.target).toBeUndefined();
  });

  it('los descriptores son datos serializables (sin GameObjects)', () => {
    const buttons: readonly MenuButtonDescriptor[] = menuButtonsFor({ inProgress: true });
    expect(() => JSON.parse(JSON.stringify(buttons))).not.toThrow();
  });
});

describe('beginJourney — «Comenzar» marca inProgress Y reinicia el checkpoint (SPEC §11 + Fase 4)', () => {
  it('marca la partida en curso vía SaveSystem', () => {
    const save = new SaveSystem(new FakeStorage());
    expect(save.inProgress).toBe(false);
    beginJourney(save);
    expect(save.inProgress).toBe(true);
  });

  it('una partida NUEVA siempre arranca en el nivel 1 (descarta el checkpoint previo)', () => {
    const save = new SaveSystem(new FakeStorage());
    save.setCurrentLevel(2); // tanda anterior detenida en el N2
    beginJourney(save);
    expect(save.currentLevel).toBe(1);
  });

  it('tras comenzar, el menú mostraría «Continuar»', () => {
    const save = new SaveSystem(new FakeStorage());
    beginJourney(save);
    expect(menuButtonsFor(save.getData()).some((b) => b.id === MenuButtonId.Continue)).toBe(true);
  });

  it('el marcaje PERSISTE (recargar = nuevo SaveSystem sobre el mismo storage)', () => {
    const storage = new FakeStorage();
    beginJourney(new SaveSystem(storage));
    const reloaded = new SaveSystem(storage);
    expect(reloaded.inProgress).toBe(true);
    expect(reloaded.currentLevel).toBe(1);
  });
});

describe('MenuScene — wiring del flujo (leído como fuente: jsdom no puede cargar Phaser)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/scenes/MenuScene.ts'), 'utf8');

  it('REGRESIÓN (Fase 5): «Continuar» navega a INTRO con el nivel GUARDADO en el payload', () => {
    // La rama Continue pasa { levelId: saveSystem.currentLevel } — la intro
    // es quien reenvía el destino a NARRATIVE al cerrar.
    expect(source).toContain(
      'transitionTo(this, SceneKey.INTRO, { levelId: saveSystem.currentLevel })',
    );
  });

  it('«Continuar» NO llama beginJourney (solo de partida nueva: resetearía el checkpoint a 1)', () => {
    // beginJourney aparece EXACTAMENTE una vez en la escena: en la rama Start.
    expect(source.match(/beginJourney\(/g)?.length).toBe(1);
    expect(source).toMatch(
      /MenuButtonId\.Start[\s\S]*?beginJourney\(saveSystem\);[\s\S]*?SceneKey\.INTRO\)/,
    );
    // Y la rama Continue no lo toca: entre su guard y su transición no hay
    // ninguna otra llamada de save (el checkpoint queda intacto).
    expect(source).toMatch(
      /MenuButtonId\.Continue[\s\S]*?transitionTo\(this, SceneKey\.INTRO, \{ levelId: saveSystem\.currentLevel \}\);/,
    );
  });

  it('«Comenzar» sigue el flujo de partida nueva: beginJourney + INTRO (payload sin levelId: default 1)', () => {
    expect(source).toMatch(
      /beginJourney\(saveSystem\);[\s\S]*?transitionTo\(this, SceneKey\.INTRO\);/,
    );
  });
});

describe('Textos del menú (SPEC §6)', () => {
  it('título placeholder y subtítulo literal', () => {
    expect(MENU_TITLE).toBe('Jekyll & Hyde [TBD]');
    expect(MENU_SUBTITLE).toBe('Una aventura por el libro de R. L. Stevenson');
  });
});

describe('HOW_TO_PLAY — 3 pasos ordenados con textos cortos (SPEC §6/§9)', () => {
  it('tiene exactamente 3 pasos', () => {
    expect(HOW_TO_PLAY.length).toBe(3);
  });

  it('orden correcto: leer → tocar → responder', () => {
    expect(HOW_TO_PLAY.map((step) => step.iconKey)).toEqual([
      TEXTURE_KEYS.iconBook,
      TEXTURE_KEYS.iconTap,
      TEXTURE_KEYS.iconQuestion,
    ]);
    expect(HOW_TO_PLAY.map((step) => step.title)).toEqual(['Lee', 'Toca', 'Responde']);
  });

  it('cada icono es una clave de textura registrada', () => {
    const registered: Set<string> = new Set(Object.values(TEXTURE_KEYS));
    for (const step of HOW_TO_PLAY) {
      expect(registered.has(step.iconKey), `${step.iconKey} no está en TEXTURE_KEYS`).toBe(true);
    }
  });

  it('textos cortos: ≤ 12 palabras por paso', () => {
    for (const step of HOW_TO_PLAY) {
      const words = step.text.trim().split(/\s+/).length;
      expect(words, `"${step.text}" (${words} palabras)`).toBeLessThanOrEqual(
        HOW_TO_PLAY_MAX_WORDS,
      );
    }
    expect(HOW_TO_PLAY_MAX_WORDS).toBe(12);
  });

  it('todo paso tiene título e icono no vacíos', () => {
    for (const step of HOW_TO_PLAY) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.iconKey.trim().length).toBeGreaterThan(0);
    }
  });

  it('titular del overlay y etiqueta de cierre en español', () => {
    expect(HOW_TO_PLAY_TITLE).toBe('Cómo jugar');
    expect(HOW_TO_PLAY_CLOSE_LABEL).toBe('Cerrar');
  });
});

describe('Wiring del toggle de mute del menú (CA: persiste tras recargar)', () => {
  /**
   * Reproduce la CADENA EXACTA que usa MenuScene: un SaveSystem real sobre
   * un storage fake + un AudioSystem cuyo contexto nunca llega a crearse
   * (toggleMute no lo necesita). El «icono» se decide con `audioSystem
   * .muted` igual que hace la escena con la textura speaker-on/off.
   */
  function makeMenuWiring(storage: StorageLike): {
    audio: AudioSystem;
    iconFor: () => string;
  } {
    const save = new SaveSystem(storage);
    const audio = new AudioSystem({
      saveSystem: save,
      createContext: (): never => {
        throw new Error('toggleMute no debe crear AudioContext');
      },
    });
    return {
      audio,
      iconFor: (): string =>
        audio.muted ? TEXTURE_KEYS.speakerOff : TEXTURE_KEYS.speakerOn,
    };
  }

  it('el toggle del menú persiste y tras «recargar» el estado sigue mutado', () => {
    const storage = new FakeStorage();
    const menu = makeMenuWiring(storage);
    expect(menu.iconFor()).toBe(TEXTURE_KEYS.speakerOn);

    const muted = menu.audio.toggleMute(); // lo que hace el botón del menú
    expect(muted).toBe(true);
    expect(menu.iconFor()).toBe(TEXTURE_KEYS.speakerOff);

    // «Recargar»: sistemas nuevos sobre el MISMO storage (como en un boot).
    const reloaded = makeMenuWiring(storage);
    expect(reloaded.audio.muted).toBe(true);
    expect(reloaded.iconFor()).toBe(TEXTURE_KEYS.speakerOff);
  });

  it('desmutear también persiste', () => {
    const storage = new FakeStorage();
    const menu = makeMenuWiring(storage);
    menu.audio.toggleMute(); // → true
    const reloaded = makeMenuWiring(storage);
    expect(reloaded.audio.toggleMute()).toBe(false);
    expect(makeMenuWiring(storage).audio.muted).toBe(false);
  });
});
