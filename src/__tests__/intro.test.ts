/**
 * Cinemática de introducción (PLAN fases 1–2/3 — el laboratorio + el callejón):
 *
 *  1. `config/intro.ts` como DATOS PUROS (jsdom no puede cargar Phaser): la
 *     máquina de beats (`INTRO_BEATS` + `nextBeatIndex`/`isLastBeat`), los
 *     letreros, el layout y los parámetros de animación de ambos actos.
 *  2. `scenes/IntroScene.ts` se valida LEYENDO EL FUENTE (patrón de los
 *     bloques «game.config — registro de escenas»): wiring de la máquina,
 *     guards de idempotencia, el acto 2 (callejón, niña, amenaza sin
 *     contacto) y el cierre con wipe de niebla.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INTRO_ALLEY_WALK,
  INTRO_BEATS,
  INTRO_CAPTIONS,
  INTRO_DRINK,
  INTRO_ENTRANCE,
  INTRO_GIRL_APPEARS,
  INTRO_MENACE,
  INTRO_PLAYER_IS_HYDE,
  INTRO_SCENE_LAYOUT,
  INTRO_TARGET_LEVEL_ID,
  INTRO_TEXTURES,
  INTRO_TRANSFORMATION,
  IntroBeatId,
  introFogSprites,
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

describe('INTRO_BEATS — máquina de actos (laboratorio + callejón)', () => {
  it('los SIETE beats van EN ORDEN: lab (aparece → bebe → se transforma) + callejón', () => {
    expect(INTRO_BEATS.map((beat) => beat.id)).toEqual([
      IntroBeatId.Entrance,
      IntroBeatId.Drink,
      IntroBeatId.Transformation,
      IntroBeatId.AlleyWalk,
      IntroBeatId.GirlAppears,
      IntroBeatId.Menace,
      IntroBeatId.PlayerIsHyde,
    ]);
  });

  it('la transformación va ANTES del acto 2: el Hyde transformado es el que acecha', () => {
    const ids = INTRO_BEATS.map((beat) => beat.id);
    expect(ids.indexOf(IntroBeatId.Transformation)).toBeLessThan(
      ids.indexOf(IntroBeatId.AlleyWalk),
    );
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

describe('INTRO_CAPTIONS — letreros del acto 2 (el callejón)', () => {
  const ACT2_IDS: readonly IntroBeatId[] = [
    IntroBeatId.AlleyWalk,
    IntroBeatId.GirlAppears,
    IntroBeatId.Menace,
    IntroBeatId.PlayerIsHyde,
  ];
  const act2 = INTRO_BEATS.filter((beat) => ACT2_IDS.includes(beat.id));

  it('los CUATRO beats del acto 2 están y todos tienen letrero', () => {
    expect(act2.map((beat) => beat.id)).toEqual([
      IntroBeatId.AlleyWalk,
      IntroBeatId.GirlAppears,
      IntroBeatId.Menace,
      IntroBeatId.PlayerIsHyde,
    ]);
    for (const beat of act2) {
      expect(beat.caption.length, `beat ${beat.id}`).toBeGreaterThan(0);
    }
  });

  it('los letreros del acto 2 retoman el lore del NIVEL 1 (paneles 3–4)', () => {
    const level = getLevel(INTRO_TARGET_LEVEL_ID);
    // El paseo y la niña son el panel 3 («Mr. Hyde camina por el callejón…»).
    expect(level?.lore[2]?.text).toContain('Mr. Hyde camina por el callejón');
    expect(INTRO_CAPTIONS.alleyWalk).toContain('Mr. Hyde camina por el callejón');
    expect(level?.lore[2]?.text).toContain(INTRO_CAPTIONS.girlAppears);
    // El susurro del panel 4 reaparece en el cierre dirigido al jugador.
    expect(level?.lore[3]?.text).toContain('Es hora del susto');
    expect(INTRO_CAPTIONS.playerIsHyde).toContain('Es hora del susto');
  });

  it('el ÚLTIMO beat cierra dirigiéndose al JUGADOR: «tú eres Mr. Hyde» (feedback clave)', () => {
    const last = INTRO_BEATS[INTRO_BEATS.length - 1];
    expect(last?.id).toBe(IntroBeatId.PlayerIsHyde);
    const normalized = last?.caption.toLowerCase() ?? '';
    expect(normalized).toContain('tú');
    expect(normalized).toContain('mr. hyde');
    expect(normalized).toContain('susto');
  });

  it('el letrero de la amenaza es SUGERIDA (sin léxico de daño: tono 10+)', () => {
    expect(INTRO_CAPTIONS.menace).toContain('alza el brazo');
    expect(INTRO_CAPTIONS.menace).toContain('asustada');
    // El corpus de content.test prohíbe «golpe» — la amenaza jamás se materializa.
    expect(INTRO_CAPTIONS.menace.toLowerCase()).not.toContain('golpe');
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

  it('presupuesto de niebla (SPEC §10.4 ≤ 30): TODOS los puffs de la cinemática + slots del fondo «lab»', () => {
    const labFogSlots = LAB_PARALLAX_LAYERS.filter(
      (layer) => layer.key === TEXTURE_KEYS.fog,
    ).reduce((sum, layer) => sum + layer.slots.length, 0);
    // 8 (transformación) + 3 unitarios (trago, farol, ojo) + 2 (acecho) + 5 (cierre).
    expect(introFogSprites()).toBe(18);
    expect(labFogSlots + introFogSprites()).toBeLessThanOrEqual(30);
  });

  it('las texturas referenciadas por la intro están registradas', () => {
    const registered = new Set(Object.values(TEXTURE_KEYS));
    for (const key of Object.values(INTRO_TEXTURES)) {
      expect(registered.has(key), `${key} no está en TEXTURE_KEYS`).toBe(true);
    }
    expect(INTRO_TEXTURES.jekyll).toBe('jekyll');
    expect(INTRO_TEXTURES.hyde).toBe('hyde');
    expect(INTRO_TEXTURES.girl).toBe('girl');
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

// ---- Parámetros de animación del acto 2 (los tweens viven en la escena) -------

describe('configs de animación del acto 2 (el callejón)', () => {
  it('ALLEY_WALK: Hyde entra desde FUERA del lienzo y camina hacia el centro-izquierda', () => {
    const W = INTRO_ALLEY_WALK;
    const { character } = INTRO_SCENE_LAYOUT;
    expect(W.fromX).toBeLessThan(0); // fuera del lienzo por la izquierda
    expect(W.toX).toBeGreaterThan(0);
    expect(W.toX).toBeLessThan(BASE_WIDTH / 2); // deja la esquina derecha libre
    expect(W.walkMs).toBeGreaterThan(0);
    expect(W.emergeMs).toBeGreaterThan(0);
    expect(W.emergeMs).toBeLessThan(W.walkMs); // emerge mientras camina
    expect(W.bob.px).toBeGreaterThan(0);
    expect(W.bob.cycleMs).toBeGreaterThan(0);
    expect(W.rockRad).toBeLessThan(0.1); // balanceo sutil, paso humano
    // Camina a la ALTURA del personaje (mismo suelo que el laboratorio).
    expect(W.toX).toBeLessThan(character.x);
  });

  it('GIRL_APPEARS: la niña entra desde la derecha, MÁS PEQUEÑA que Hyde, con farol vivo', () => {
    const G = INTRO_GIRL_APPEARS;
    const { girl, character } = INTRO_SCENE_LAYOUT;
    expect(G.fromX).toBeGreaterThanOrEqual(BASE_WIDTH); // fuera del lienzo
    expect(G.enterMs).toBeGreaterThan(0);
    expect(G.tremble.rad).toBeGreaterThan(0);
    expect(G.tremble.rad).toBeLessThan(0.1); // temblor sutil del farol
    expect(G.glow.alpha).toBeGreaterThan(0);
    expect(G.glow.alpha).toBeLessThan(0.6); // resplandor, no farol strobo
    expect(G.glow.breatheMs).toBeGreaterThan(0);
    // Ella es una niña: más pequeña que Hyde y más lejos (más alta en escena).
    expect(girl.scale).toBeLessThan(character.scale);
    expect(girl.y).toBeLessThan(character.y);
    expect(girl.x).toBeGreaterThan(INTRO_ALLEY_WALK.toX); // a la derecha de Hyde
  });

  it('MENACE: el acecho avanza SIN alcanzarla y el brazo queda a MEDIAS (el golpe nunca cae)', () => {
    const M = INTRO_MENACE;
    const { girl } = INTRO_SCENE_LAYOUT;
    expect(M.seeDelayMs).toBeGreaterThan(0);
    expect(M.eyeFlare.durationMs).toBeGreaterThan(0);
    expect(M.eyeFlare.scale).toBeGreaterThan(0);
    expect(M.lunge.durationMs).toBeGreaterThan(0);
    // NUNCA la alcanza: Hyde se queda a la izquierda de la niña encogida.
    expect(M.lunge.toX).toBeLessThan(girl.x);
    expect(M.flinch.toX).toBeGreaterThan(girl.x); // se encoge HACIA ATRÁS
    expect(M.flinch.toX).toBeLessThan(BASE_WIDTH); // sin salir del lienzo
    // Alza el brazo a MEDIAS: rotación parcial (amenaza sugerida, 10+).
    expect(Math.abs(M.armRaise.rad)).toBeGreaterThan(0.2);
    expect(Math.abs(M.armRaise.rad)).toBeLessThan(1);
    expect(M.armRaise.durationMs).toBeGreaterThan(0);
    expect(M.tremble.scaleY).toBeLessThan(1); // se hace pequeña
    expect(M.tremble.repeats).toBeGreaterThanOrEqual(1);
    expect(M.puffs.count).toBeGreaterThanOrEqual(1);
  });

  it('PLAYER_IS_HYDE: el brazo sigue EN ALTO (relajado un pelín) y la niebla crece sin tapar el letrero', () => {
    const C = INTRO_PLAYER_IS_HYDE;
    // Pose congelada: menos rotación que el alzo (el golpe NUNCA se completa).
    expect(C.armHoldRad).toBeLessThan(0);
    expect(C.armHoldRad).toBeGreaterThan(INTRO_MENACE.armRaise.rad);
    expect(C.veil.alpha).toBeGreaterThan(0);
    expect(C.veil.alpha).toBeLessThanOrEqual(0.5); // el letrero se lee igual
    expect(C.veil.durationMs).toBeGreaterThan(0);
    expect(C.puffs.count).toBeGreaterThanOrEqual(3);
    expect(C.puffs.durationMs).toBeGreaterThan(0);
  });

  it('introFogSprites suma los puffs transitorios de TODA la cinemática (datos puros)', () => {
    expect(introFogSprites()).toBe(
      INTRO_TRANSFORMATION.puffs.count +
        INTRO_MENACE.puffs.count +
        INTRO_PLAYER_IS_HYDE.puffs.count +
        3, // unitarios: el trago, el farol de la niña y el destello del ojo
    );
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

  it('la niña (acto 2) queda dentro del lienzo, entre el velo y los personajes', () => {
    const { girl, character, caption, backgroundVeilDepth } = INTRO_SCENE_LAYOUT;
    expect(girl.x).toBeGreaterThan(0);
    expect(girl.x).toBeLessThan(BASE_WIDTH);
    expect(girl.y).toBeGreaterThan(0);
    expect(girl.y).toBeLessThan(BASE_HEIGHT);
    expect(girl.scale).toBeGreaterThan(0);
    // Sobre el velo de trocado de fondo y DETRÁS de Hyde (si solapan).
    expect(girl.depth).toBeGreaterThan(backgroundVeilDepth);
    expect(girl.depth).toBeLessThan(character.depth);
    // Y bajo el letrero, como el resto de la escena.
    expect(caption.y).toBeGreaterThan(girl.y);
  });

  it('el velo de niebla del cierre cubre a los personajes pero NO el letrero', () => {
    const { closingVeilDepth, character, caption, flashDepth } = INTRO_SCENE_LAYOUT;
    expect(closingVeilDepth).toBeGreaterThan(character.depth);
    expect(closingVeilDepth).toBeLessThan(caption.depth);
    expect(closingVeilDepth).toBeLessThan(flashDepth);
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

  it('el fondo se construye desde LORE_BACKGROUNDS (el acto 2 troca al callejón)', () => {
    expect(source).toContain('buildBackground(LORE_BACKGROUNDS.lab)');
    expect(source).toContain('LORE_BACKGROUNDS.alley'); // el trocado del acto 2
    expect(source).toContain('new ParallaxField(');
  });

  it('el ACTO 2 tiene players para sus cuatro beats (Record exhaustivo)', () => {
    expect(source).toContain('[IntroBeatId.AlleyWalk]: (beat) => this.playAlleyWalk(beat)');
    expect(source).toContain('[IntroBeatId.GirlAppears]: (beat) => this.playGirlAppears(beat)');
    expect(source).toContain('[IntroBeatId.Menace]: (beat) => this.playMenace(beat)');
    expect(source).toContain('[IntroBeatId.PlayerIsHyde]: (beat) => this.playPlayerIsHyde(beat)');
  });

  it('el paseo troca al callejón CON velo y Hyde emerge de la niebla (fade-in)', () => {
    expect(source).toContain('buildBackground(LORE_BACKGROUNDS.alley, true)');
    // Normaliza la aparición: entra desde fuera (alpha 0) y emerge caminando.
    expect(source).toMatch(/private playAlleyWalk\([\s\S]*?alpha: \{ from: 0, to: 1 \}/);
  });

  it('la niña es un actor fijo oculto hasta su beat, con el farol hacia Hyde (flipX)', () => {
    expect(source).toContain('private girl!: Phaser.GameObjects.Image');
    expect(source).toContain('INTRO_TEXTURES.girl');
    expect(source).toContain('.setFlipX(true)');
    // CADA player del acto 2 normaliza su visibilidad: el paseo la oculta…
    expect(source).toContain('this.girl.setVisible(false)');
    // …y los otros tres la traen a escena con su estado completo.
    expect(source.match(/this\.girl\s*\.setVisible\(true\)/g)?.length).toBe(3);
  });

  it('la amenaza es SIN CONTACTO: el brazo se alza a medias y el beat termina antes de golpear', () => {
    // El alzo va ENCADENADO al avance (onComplete) y rota PARCIALMENTE…
    expect(source).toMatch(
      /private playMenace\([\s\S]*?onComplete[\s\S]*?rotation: \{ from: 0, to: M\.armRaise\.rad \}/,
    );
    // …y el cierre congela la pose con el brazo EN ALTO, sin completar nada.
    expect(source).toContain('setPosition(INTRO_MENACE.lunge.toX, character.y)');
    expect(source).toContain('.setRotation(C.armHoldRad)');
    // La niña reacciona (retroceso + temblor) pero nadie la toca.
    expect(source).toMatch(
      /private playMenace\([\s\S]*?scaleY: girl\.scale \* M\.tremble\.scaleY/,
    );
  });

  it('el cierre del acto 2 hace crecer la niebla (velo + puffs) SIN duplicar el wipe', () => {
    expect(source).toContain('this.spawnClosingFog()');
    expect(source).toContain('private spawnClosingFog(): void');
    // El wipe de niebla sigue siendo ÚNICO (lo dispara el flujo existente).
    expect(source.match(/wipeTo\(/g)?.length).toBe(1);
  });

  it('los players del acto 2 no usan delayedCall propios (solo tweens: clearBeatFx los mata)', () => {
    // ÚNICA llamada real: el timer de auto-avance del beat (las menciones en
    // comentarios no cuentan).
    expect(source.match(/this\.time\.delayedCall/g)?.length).toBe(1);
    expect(source).toContain('this.time.delayedCall(beat.durationMs');
  });
});
