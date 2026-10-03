/**
 * Cinemática de introducción (PLAN fase 1/3 — el laboratorio de Jekyll):
 *
 *  1. `config/intro.ts` como DATOS PUROS (jsdom no puede cargar Phaser): la
 *     máquina de beats (`INTRO_BEATS` + `nextBeatIndex`/`isLastBeat`), los
 *     letreros, el layout y los parámetros de animación.
 *  2. `scenes/IntroScene.ts` se valida LEYENDO EL FUENTE (patrón de los
 *     bloques «game.config — registro de escenas»): wiring de la máquina,
 *     guards de idempotencia y el cierre con wipe de niebla.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INTRO_BEATS,
  INTRO_CAPTIONS,
  INTRO_DRINK,
  INTRO_ENTRANCE,
  INTRO_SCENE_LAYOUT,
  INTRO_TARGET_LEVEL_ID,
  INTRO_TEXTURES,
  INTRO_TRANSFORMATION,
  IntroBeatId,
  isLastBeat,
  nextBeatIndex,
  puffTintFor,
} from '../config/intro';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { getLevel } from '../config/levels';
import { LAB_PARALLAX_LAYERS } from '../art/parallax';
import { TEXTURE_KEYS } from '../art/textures';
import { NARRATIVE_SKIP_BUTTON } from '../config/narrative';

// ---- Máquina de beats ---------------------------------------------------------

describe('INTRO_BEATS — máquina de actos del acto 1', () => {
  it('el acto 1 tiene 3 beats EN ORDEN: aparece → bebe → se transforma', () => {
    expect(INTRO_BEATS.map((beat) => beat.id)).toEqual([
      IntroBeatId.Entrance,
      IntroBeatId.Drink,
      IntroBeatId.Transformation,
    ]);
  });

  it('los ids de los beats son únicos', () => {
    const ids = INTRO_BEATS.map((beat) => beat.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada beat tiene duración positiva y con cuerpo (ritmo de cinemática)', () => {
    for (const beat of INTRO_BEATS) {
      expect(beat.durationMs, `beat ${beat.id}`).toBeGreaterThan(800);
    }
    // La cinemática completa cabe en medio minuto (público infantil).
    const total = INTRO_BEATS.reduce((sum, beat) => sum + beat.durationMs, 0);
    expect(total).toBeLessThanOrEqual(30000);
  });

  it('nextBeatIndex avanza y devuelve -1 en el ÚLTIMO beat (cierre de la intro)', () => {
    expect(nextBeatIndex(0)).toBe(1);
    expect(nextBeatIndex(1)).toBe(2);
    expect(nextBeatIndex(INTRO_BEATS.length - 1)).toBe(-1);
    expect(nextBeatIndex(-1)).toBe(-1);
    expect(nextBeatIndex(99)).toBe(-1);
  });

  it('isLastBeat solo es true en el último índice válido', () => {
    expect(isLastBeat(0)).toBe(false);
    expect(isLastBeat(INTRO_BEATS.length - 1)).toBe(true);
    expect(isLastBeat(-1)).toBe(false);
  });
});

// ---- Captions (texto visible — pasan por content.test) ------------------------

describe('INTRO_CAPTIONS — letreros del acto 1', () => {
  it('la entrada y la transformación tienen letrero; la bebida mantiene el anterior', () => {
    const [entrance, drink, transformation] = INTRO_BEATS;
    expect(entrance?.caption.length).toBeGreaterThan(0);
    expect(drink?.caption).toBe('');
    expect(transformation?.caption.length).toBeGreaterThan(0);
  });

  it('el letrero de entrada sitúa época y protagonista (coherente con el N1)', () => {
    expect(INTRO_CAPTIONS.entrance).toContain('188X');
    expect(INTRO_CAPTIONS.entrance).toContain('Jekyll');
  });

  it('el letrero de la transformación es el remate del hechizo del nivel 1', () => {
    expect(INTRO_CAPTIONS.transformation).toBe('…y deja de ser él.');
  });
});

// ---- Destino y coherencia con el resto del juego ------------------------------

describe('INTRO — destino y presupuesto de niebla', () => {
  it('la intro desemboca en el nivel 1, que existe en el registro', () => {
    expect(INTRO_TARGET_LEVEL_ID).toBe(1);
    expect(getLevel(INTRO_TARGET_LEVEL_ID)).toBeDefined();
  });

  it('el botón «Saltar» de la intro reutiliza el estilo del de la narrativa', () => {
    // La escena consume NARRATIVE_SKIP_BUTTON directamente (wiring testeado
    // abajo leyendo el fuente); aquí se fija la etiqueta compartida.
    expect(NARRATIVE_SKIP_BUTTON.label).toBe('Saltar');
  });

  it('presupuesto de niebla (SPEC §10.4 ≤ 30): puffs de la transformación + slots del fondo «lab»', () => {
    const labFogSlots = LAB_PARALLAX_LAYERS.filter(
      (layer) => layer.key === TEXTURE_KEYS.fog,
    ).reduce((sum, layer) => sum + layer.slots.length, 0);
    expect(labFogSlots + INTRO_TRANSFORMATION.puffs.count).toBeLessThanOrEqual(30);
  });

  it('las texturas referenciadas por la intro están registradas', () => {
    const registered = new Set(Object.values(TEXTURE_KEYS));
    for (const key of Object.values(INTRO_TEXTURES)) {
      expect(registered.has(key), `${key} no está en TEXTURE_KEYS`).toBe(true);
    }
    expect(INTRO_TEXTURES.jekyll).toBe('jekyll');
    expect(INTRO_TEXTURES.hyde).toBe('hyde');
  });
});

// ---- Parámetros de animación (los tweens viven en la escena) -------------------

describe('configs de animación por beat', () => {
  it('ENTRANCE: fade positivo y pop de escala contenido', () => {
    expect(INTRO_ENTRANCE.fadeMs).toBeGreaterThan(0);
    expect(INTRO_ENTRANCE.scaleFrom).toBeGreaterThan(0);
    expect(INTRO_ENTRANCE.scaleFrom).toBeLessThan(1);
  });

  it('DRINK: inclinación parcial (no un giro completo) y timings positivos', () => {
    expect(Math.abs(INTRO_DRINK.tiltRad)).toBeLessThan(1);
    expect(INTRO_DRINK.tiltMs).toBeGreaterThan(0);
    expect(INTRO_DRINK.holdMs).toBeGreaterThan(0);
    expect(INTRO_DRINK.returnMs).toBeGreaterThan(0);
    expect(INTRO_DRINK.gulp.durationMs).toBeGreaterThan(0);
    expect(INTRO_DRINK.gulp.scale).toBeGreaterThan(0);
  });

  it('TRANSFORMATION: flash, sacudida, puffs, crossfade, pop y halo con valores válidos', () => {
    const T = INTRO_TRANSFORMATION;
    expect(T.flash.durationMs).toBeGreaterThan(0);
    expect(T.flash.peakAlpha).toBeGreaterThan(0);
    expect(T.flash.peakAlpha).toBeLessThanOrEqual(1);
    expect(T.shake.durationMs).toBeGreaterThan(0);
    expect(T.shake.intensity).toBeGreaterThan(0);
    expect(T.shake.intensity).toBeLessThan(0.05); // sutil, público infantil
    expect(T.tremble.repeats).toBeGreaterThanOrEqual(1);
    expect(T.puffs.count).toBeGreaterThanOrEqual(4);
    expect(T.puffs.staggerMs).toBeGreaterThanOrEqual(0);
    expect(T.puffs.tints.length).toBeGreaterThanOrEqual(1);
    expect(T.crossfadeDelayMs).toBeGreaterThanOrEqual(0);
    expect(T.crossfadeMs).toBeGreaterThan(0);
    expect(T.pop.fromFactor).toBeGreaterThan(0);
    expect(T.pop.fromFactor).toBeLessThan(1);
    expect(T.halo.startAlpha).toBeGreaterThan(0);
    expect(T.halo.toScale).toBeGreaterThan(T.halo.fromScale);
    expect(T.halo.durationMs).toBeGreaterThan(0);
  });

  it('puffTintFor alterna los tintes de forma determinista', () => {
    expect(puffTintFor(0)).toBe(INTRO_TRANSFORMATION.puffs.tints[0]);
    expect(puffTintFor(0)).toBe(puffTintFor(INTRO_TRANSFORMATION.puffs.tints.length));
  });
});

// ---- Layout (sobre el lienzo 720×1280) ------------------------------------------

describe('INTRO_SCENE_LAYOUT — composición de la escena', () => {
  it('el personaje queda dentro del lienzo y por encima del letrero', () => {
    const { character, caption } = INTRO_SCENE_LAYOUT;
    expect(character.x).toBeGreaterThan(0);
    expect(character.x).toBeLessThan(BASE_WIDTH);
    expect(character.y).toBeGreaterThan(0);
    expect(character.y).toBeLessThan(BASE_HEIGHT);
    expect(character.scale).toBeGreaterThan(0);
    expect(character.depth).toBeGreaterThan(0);
    // El letrero vive en el tercio inferior, debajo de los pies del personaje.
    expect(caption.y).toBeGreaterThan(character.y);
    expect(caption.y).toBeLessThan(BASE_HEIGHT);
  });

  it('profundidades ordenadas: fondo < personajes < letrero < flash', () => {
    const { character, caption, flashDepth } = INTRO_SCENE_LAYOUT;
    expect(flashDepth).toBeGreaterThan(caption.depth);
    expect(caption.depth).toBeGreaterThan(character.depth);
    expect(INTRO_SCENE_LAYOUT.backgroundVeilDepth).toBeLessThan(character.depth);
  });

  it('el botón «Saltar» queda dentro del lienzo con margen', () => {
    const { skipButton } = INTRO_SCENE_LAYOUT;
    expect(skipButton.x).toBeGreaterThan(0);
    expect(skipButton.x).toBeLessThan(BASE_WIDTH);
    expect(skipButton.y).toBeGreaterThan(0);
    expect(skipButton.y).toBeLessThan(BASE_HEIGHT);
  });
});

// ---- IntroScene — wiring leído como fuente (jsdom no puede cargar Phaser) ------

describe('IntroScene — wiring de la máquina de beats (leído como fuente)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/scenes/IntroScene.ts'), 'utf8');

  it('arranca en el beat 0 y auto-avanza con el timer de cada beat', () => {
    expect(source).toContain('this.enterBeat(0)');
    expect(source).toContain('this.time.delayedCall(beat.durationMs');
  });

  it('el tap en cualquier parte avanza (capa POINTER_DOWN bajo la UI) con blip', () => {
    expect(source).toMatch(/POINTER_DOWN/);
    expect(source).toMatch(/onTap[\s\S]*audioSystem\.blip\(\)/);
  });

  it('guard de idempotencia: `exiting` corta taps y el `clearBeatFx` limpia tweens/timer/FX', () => {
    expect(source).toMatch(/private exiting = false/);
    expect(source.match(/if \(this\.exiting\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('this.tweens.killAll()');
    expect(source).toContain('this.beatTimer?.remove(false)');
    expect(source).toContain('for (const fx of this.beatFx)');
  });

  it('la transformación usa flash fullscreen, shake de cámara, puffs y crossfade', () => {
    expect(source).toContain('this.cameras.main.shake(');
    expect(source).toContain('INTRO_TEXTURES.puff');
    expect(source).toContain('alpha: { from: 1, to: 0 }'); // Jekyll se apaga…
    expect(source).toContain('alpha: { from: 0, to: 1 }'); // …mientras Hyde aparece
    expect(source).toContain('Back.easeOut'); // pop de escala al revelar
  });

  it('el cierre es SIEMPRE wipe de niebla hacia NARRATIVE con { levelId }', () => {
    expect(source).toContain(
      'wipeTo(this, SceneKey.NARRATIVE, { levelId: INTRO_TARGET_LEVEL_ID })',
    );
    // Un único punto de salida (exitToNarrative con guard propio).
    expect(source.match(/wipeTo\(/g)?.length).toBe(1);
  });

  it('usa fadeIn, fondo de noche y el botón «Saltar» de la narrativa', () => {
    expect(source).toContain('fadeIn(this)');
    expect(source).toContain('setBackgroundColor(nightBackground)');
    expect(source).toContain('NARRATIVE_SKIP_BUTTON');
  });

  it('el fondo se construye desde LORE_BACKGROUNDS (reutilizable para la fase 2)', () => {
    expect(source).toContain('buildBackground(LORE_BACKGROUNDS.lab)');
    expect(source).toContain('LORE_BACKGROUNDS.alley'); // documentado para el acto 2
    expect(source).toContain('new ParallaxField(');
  });
});
