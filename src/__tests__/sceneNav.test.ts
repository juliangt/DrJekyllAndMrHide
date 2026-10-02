/**
 * Etapa 1 — test de la navegación del flujo (SPEC §3) como DATOS PUROS:
 * SceneKey (8 claves, GAME_OVER = overlay), NEXT_SCENE (cadena principal),
 * ALT_TRANSITIONS (quiz fallo → NARRATIVE, timeout → GAME_OVER) y el
 * registro de escenas de game.config (leído como fuente, como el test de
 * index.html: importar ese módulo cargaría Phaser, imposible en jsdom).
 *
 * Etapa 2 — además, el helper `transitionTo` se ejercita con un FAKE
 * estructural de Scene/Camera (sceneNav importa Phaser solo como TIPO).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALT_TRANSITIONS,
  FADE_DURATION_MS,
  NEXT_SCENE,
  nextSceneKey,
  transitionTo,
} from '../scenes/sceneNav';
import type Phaser from 'phaser';
import { SceneKey } from '../config/sceneKeys';

describe('SceneKey — las 8 claves del flujo (SPEC §3)', () => {
  it('tiene exactamente BOOT, PRELOAD, MENU, NARRATIVE, ACTION, GAME_OVER, QUIZ, VICTORY', () => {
    expect(Object.keys(SceneKey).sort()).toEqual(
      ['ACTION', 'BOOT', 'GAME_OVER', 'MENU', 'NARRATIVE', 'PRELOAD', 'QUIZ', 'VICTORY'].sort(),
    );
  });

  it('los valores son únicos', () => {
    const values = Object.values(SceneKey);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('NEXT_SCENE — cadena principal (SPEC §3)', () => {
  it('BOOT → PRELOAD', () => {
    expect(NEXT_SCENE[SceneKey.BOOT]).toBe(SceneKey.PRELOAD);
  });

  it('PRELOAD → MENU', () => {
    expect(NEXT_SCENE[SceneKey.PRELOAD]).toBe(SceneKey.MENU);
  });

  it('MENU → NARRATIVE', () => {
    expect(NEXT_SCENE[SceneKey.MENU]).toBe(SceneKey.NARRATIVE);
  });

  it('NARRATIVE → ACTION', () => {
    expect(NEXT_SCENE[SceneKey.NARRATIVE]).toBe(SceneKey.ACTION);
  });

  it('ACTION (meta alcanzada) → QUIZ', () => {
    expect(NEXT_SCENE[SceneKey.ACTION]).toBe(SceneKey.QUIZ);
  });

  it('QUIZ (correcta) → VICTORY', () => {
    expect(NEXT_SCENE[SceneKey.QUIZ]).toBe(SceneKey.VICTORY);
  });

  it('VICTORY («Volver al inicio») → MENU', () => {
    expect(NEXT_SCENE[SceneKey.VICTORY]).toBe(SceneKey.MENU);
  });

  it('GAME_OVER («Reintentar») → ACTION (solo el minijuego, D6)', () => {
    expect(NEXT_SCENE[SceneKey.GAME_OVER]).toBe(SceneKey.ACTION);
  });

  it('está definida para TODAS las claves (sin huecos)', () => {
    for (const key of Object.values(SceneKey)) {
      expect(NEXT_SCENE[key], `NEXT_SCENE[${key}]`).toBeDefined();
    }
  });

  it('caminando la cadena desde BOOT se recorre el flujo del SPEC §3', () => {
    const path: string[] = [SceneKey.BOOT];
    let current: string = SceneKey.BOOT;
    for (let i = 0; i < 6; i++) {
      current = NEXT_SCENE[current as keyof typeof NEXT_SCENE];
      path.push(current);
    }
    expect(path).toEqual([
      SceneKey.BOOT,
      SceneKey.PRELOAD,
      SceneKey.MENU,
      SceneKey.NARRATIVE,
      SceneKey.ACTION,
      SceneKey.QUIZ,
      SceneKey.VICTORY,
    ]);
  });
});

describe('ALT_TRANSITIONS — salidas condicionales (SPEC §3)', () => {
  it('quiz fallido → NARRATIVE (reinicio de nivel completo, D5)', () => {
    expect(ALT_TRANSITIONS.quizWrong).toEqual({ from: SceneKey.QUIZ, to: SceneKey.NARRATIVE });
  });

  it('timeout de ACTION → GAME_OVER (overlay)', () => {
    expect(ALT_TRANSITIONS.actionTimeout).toEqual({
      from: SceneKey.ACTION,
      to: SceneKey.GAME_OVER,
    });
  });
});

describe('nextSceneKey — helper', () => {
  it('devuelve la siguiente escena de la cadena', () => {
    expect(nextSceneKey(SceneKey.BOOT)).toBe(SceneKey.PRELOAD);
    expect(nextSceneKey(SceneKey.QUIZ)).toBe(SceneKey.VICTORY);
    expect(nextSceneKey(SceneKey.GAME_OVER)).toBe(SceneKey.ACTION);
  });
});

// ---- transitionTo con fakes estructurales (guard de reentrada, Etapa 2) -----

type FadeHandler = () => void;

/** Cámara fake: graba once/off/fadeOut y permite disparar el fade completo. */
class FakeCamera {
  readonly fadeOutCalls: number[][] = [];
  readonly offCalls: Array<[string, FadeHandler]> = [];
  private readonly listeners = new Map<string, Set<FadeHandler>>();

  once(event: string, handler: FadeHandler): this {
    const set = this.listeners.get(event) ?? new Set<FadeHandler>();
    set.add(handler);
    this.listeners.set(event, set);
    return this;
  }

  off(event: string, handler: FadeHandler): this {
    this.offCalls.push([event, handler]);
    this.listeners.get(event)?.delete(handler);
    return this;
  }

  fadeOut(duration: number, r: number, g: number, b: number): this {
    this.fadeOutCalls.push([duration, r, g, b]);
    return this;
  }

  /** Dispara 'camerafadeoutcomplete' (los `once` se retiran al disparar). */
  completeFade(): void {
    const set = this.listeners.get('camerafadeoutcomplete');
    if (!set) return;
    const handlers = [...set];
    set.clear(); // semántica de `once`: el handler muere al dispararse
    for (const handler of handlers) {
      handler();
    }
  }
}

/** Escena fake con la forma estructural que transitionTo toca. */
class FakeScene {
  readonly cam = new FakeCamera();
  readonly started: Array<[string, object | undefined]> = [];
  readonly cameras = { main: this.cam };
  readonly scene = {
    start: (key: string, data?: object): void => {
      this.started.push([key, data]);
    },
  };
}

const asPhaserScene = (fake: FakeScene): Phaser.Scene => fake as unknown as Phaser.Scene;

describe('transitionTo — fade + start (con fakes)', () => {
  it('registra el fade con el color de noche y arranca la escena al completarse', () => {
    const fake = new FakeScene();
    transitionTo(asPhaserScene(fake), SceneKey.MENU);
    expect(fake.cam.fadeOutCalls.length).toBe(1);
    const [duration, r, g, b] = fake.cam.fadeOutCalls[0];
    expect(duration).toBe(FADE_DURATION_MS);
    expect([r, g, b]).toEqual([0x0d, 0x0f, 0x14]); // nightBackground
    expect(fake.started.length).toBe(0); // aún no arrancó
    fake.cam.completeFade();
    expect(fake.started).toEqual([[SceneKey.MENU, undefined]]);
  });

  it('pasa data a la escena destino', () => {
    const fake = new FakeScene();
    transitionTo(asPhaserScene(fake), SceneKey.ACTION, { levelId: 1 });
    fake.cam.completeFade();
    expect(fake.started).toEqual([[SceneKey.ACTION, { levelId: 1 }]]);
  });
});

describe('transitionTo — guard de reentrada (deuda de la etapa anterior)', () => {
  it('dos llamadas seguidas: el primer handler se retira y scene.start corre UNA vez', () => {
    const fake = new FakeScene();
    transitionTo(asPhaserScene(fake), SceneKey.NARRATIVE);
    transitionTo(asPhaserScene(fake), SceneKey.NARRATIVE); // doble tap rápido

    // El once de la primera llamada fue dado de baja (gana la última).
    expect(fake.cam.offCalls.length).toBe(1);
    expect(fake.cam.offCalls[0][0]).toBe('camerafadeoutcomplete');
    expect(fake.cam.fadeOutCalls.length).toBe(2);

    fake.cam.completeFade();
    expect(fake.started.length).toBe(1);
    expect(fake.started[0][0]).toBe(SceneKey.NARRATIVE);
  });

  it('gana la ÚLTIMA llamada (destino distinto entre doble taps)', () => {
    const fake = new FakeScene();
    transitionTo(asPhaserScene(fake), SceneKey.MENU);
    transitionTo(asPhaserScene(fake), SceneKey.QUIZ);
    fake.cam.completeFade();
    expect(fake.started).toEqual([[SceneKey.QUIZ, undefined]]);
  });

  it('tres llamadas: quedan UN handler vivo y UN start', () => {
    const fake = new FakeScene();
    transitionTo(asPhaserScene(fake), SceneKey.MENU);
    transitionTo(asPhaserScene(fake), SceneKey.MENU);
    transitionTo(asPhaserScene(fake), SceneKey.MENU);
    expect(fake.cam.offCalls.length).toBe(2);
    fake.cam.completeFade();
    expect(fake.started.length).toBe(1);
  });

  it('una vez completado el fade, una NUEVA transición vuelve a funcionar (escenas reutilizables)', () => {
    const fake = new FakeScene();
    transitionTo(asPhaserScene(fake), SceneKey.MENU);
    fake.cam.completeFade();
    // La escena volvió a crear(): puede transicionar de nuevo.
    transitionTo(asPhaserScene(fake), SceneKey.PRELOAD);
    fake.cam.completeFade();
    expect(fake.started.map(([key]) => key)).toEqual([SceneKey.MENU, SceneKey.PRELOAD]);
  });

  it('escenas DISTINTAS no interfieren entre sí (WeakMap por escena)', () => {
    const a = new FakeScene();
    const b = new FakeScene();
    transitionTo(asPhaserScene(a), SceneKey.MENU);
    transitionTo(asPhaserScene(b), SceneKey.PRELOAD);
    expect(b.cam.offCalls.length).toBe(0); // b no hereda el guard de a
    a.cam.completeFade();
    b.cam.completeFade();
    expect(a.started.length).toBe(1);
    expect(b.started.length).toBe(1);
  });
});

describe('game.config.ts — registro de escenas y escala (leído como fuente)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/config/game.config.ts'), 'utf8');

  it('registra las 7 escenas con archivo (SPEC §10.2), en orden del flujo', () => {
    const scenesBlock = source.slice(
      source.indexOf('export const SCENES'),
      source.indexOf('];', source.indexOf('export const SCENES')),
    );
    const expected = [
      'BootScene',
      'PreloadScene',
      'MenuScene',
      'NarrativeScene',
      'ActionScene',
      'QuizScene',
      'VictoryScene',
    ];
    let cursor = -1;
    for (const sceneClass of expected) {
      const at = scenesBlock.indexOf(sceneClass, cursor + 1);
      expect(at, `${sceneClass} registrado en orden`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it('NO registra ninguna escena GameOver (GAME_OVER es overlay de ActionScene)', () => {
    expect(source).not.toContain('GameOverScene');
  });

  it('usa Scale.FIT + CENTER_BOTH con 720×1280', () => {
    expect(source).toContain('Phaser.Scale.FIT');
    expect(source).toContain('Phaser.Scale.CENTER_BOTH');
    expect(source).toContain('BASE_WIDTH');
    expect(source).toContain('BASE_HEIGHT');
  });

  it('fondo con el color de noche de la paleta y renderer AUTO', () => {
    expect(source).toContain('backgroundColor: nightBackground');
    expect(source).toContain('Phaser.AUTO');
  });
});

describe('main.ts — consume la config centralizada (sin config inline)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');

  it('instancia el juego con gameConfig importado', () => {
    expect(source).toContain("from './config/game.config'");
    expect(source).toContain('new Phaser.Game(gameConfig)');
  });

  it('ya no define config inline (type/scale/scene emigraron a game.config)', () => {
    expect(source).not.toContain('type: Phaser.AUTO');
    expect(source).not.toContain('scale:');
    expect(source).not.toContain('scene:');
  });
});
