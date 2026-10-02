/**
 * Etapa 1 — test de la navegación del flujo (SPEC §3) como DATOS PUROS:
 * SceneKey (8 claves, GAME_OVER = overlay), NEXT_SCENE (cadena principal),
 * ALT_TRANSITIONS (quiz fallo → NARRATIVE, timeout → GAME_OVER) y el
 * registro de escenas de game.config (leído como fuente, como el test de
 * index.html: importar ese módulo cargaría Phaser, imposible en jsdom).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALT_TRANSITIONS, NEXT_SCENE, nextSceneKey } from '../scenes/sceneNav';
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
