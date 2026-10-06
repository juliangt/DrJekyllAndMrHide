/**
 * Fase 4 — EPÍLOGO (cierre de la obra, comic p. 63; se ve SOLO al ganar el
 * nivel 3):
 *
 *  1. `config/epilogue.ts` como DATOS PUROS (jsdom no puede cargar Phaser):
 *     la máquina de beats (`EPILOGUE_BEATS` + `nextEpilogueBeatIndex`/
 *     `isLastEpilogueBeat`), los letreros (incluida la cartela final VERBATIM
 *     del comic), el layout, el fondo del estudio (compuesto solo con
 *     texturas existentes), la amenaza SIN CONTACTO y el presupuesto de
 *     niebla (SPEC §10.4 ≤ 30).
 *  2. `scenes/EpilogueScene.ts` se valida LEYENDO EL FUENTE (patrón de
 *     `intro.test.ts` / `victoryScene.test.ts`): wiring de la máquina,
 *     guards de idempotencia, Hyde DETRÁS de Utterson y el cierre con wipe
 *     de niebla hacia MENU.
 *  3. El GRAFO del flujo (VICTORY final → EPILOGUE → MENU; niveles 1/2
 *     intactos) y el TRIGGER solo-en-nivel-final (`victoryExitTarget` +
 *     wiring de VictoryScene).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EPILOGUE_BACKGROUND,
  EPILOGUE_BEATS,
  EPILOGUE_CANDLE,
  EPILOGUE_CAPTIONS,
  EPILOGUE_CLOSING,
  EPILOGUE_EMERGENCE,
  EPILOGUE_FOG,
  EPILOGUE_SCENE_LAYOUT,
  EPILOGUE_STUDY,
  EPILOGUE_TEXTURES,
  EpilogueBeatId,
  epilogueFogSprites,
  fogPuffTintFor,
  isLastEpilogueBeat,
  nextEpilogueBeatIndex,
} from '../config/epilogue';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { ALT_TRANSITIONS, NEXT_SCENE, hasNextLevel, victoryExitTarget } from '../scenes/sceneNav';
import { SceneKey } from '../config/sceneKeys';
import { LEVELS } from '../config/levels';
import { TEXTURE_KEYS } from '../art/textures';
import { NARRATIVE_SKIP_BUTTON } from '../config/narrative';

// ---- Máquina de beats ---------------------------------------------------------

describe('EPILOGUE_BEATS — máquina de beats (el cierre del comic, p. 63)', () => {
  it('los CUATRO beats van EN ORDEN: estudio → niebla → aparición → cierre', () => {
    expect(EPILOGUE_BEATS.map((beat) => beat.id)).toEqual([
      EpilogueBeatId.Study,
      EpilogueBeatId.Fog,
      EpilogueBeatId.Emergence,
      EpilogueBeatId.Closing,
    ]);
  });

  it('los ids de los beats son únicos', () => {
    const ids = EPILOGUE_BEATS.map((beat) => beat.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada beat tiene duración positiva y el epílogo completo es corto (público infantil)', () => {
    for (const beat of EPILOGUE_BEATS) {
      expect(beat.durationMs, `beat ${beat.id}`).toBeGreaterThan(800);
    }
    const total = EPILOGUE_BEATS.reduce((sum, beat) => sum + beat.durationMs, 0);
    expect(total).toBeLessThanOrEqual(30000);
  });

  it('nextEpilogueBeatIndex avanza y devuelve -1 en el ÚLTIMO beat (cierre hacia MENU)', () => {
    expect(nextEpilogueBeatIndex(0)).toBe(1);
    expect(nextEpilogueBeatIndex(EPILOGUE_BEATS.length - 1)).toBe(-1);
    expect(nextEpilogueBeatIndex(-1)).toBe(-1);
    expect(nextEpilogueBeatIndex(99)).toBe(-1);
  });

  it('isLastEpilogueBeat solo es true en el último índice válido', () => {
    expect(isLastEpilogueBeat(0)).toBe(false);
    expect(isLastEpilogueBeat(EPILOGUE_BEATS.length - 1)).toBe(true);
    expect(isLastEpilogueBeat(-1)).toBe(false);
  });
});

// ---- Captions (texto visible — el corpus de content.test los cubre) -----------

describe('EPILOGUE_CAPTIONS — letreros del epílogo', () => {
  it('TODOS los beats tienen letrero (el epílogo se narra entero)', () => {
    for (const beat of EPILOGUE_BEATS) {
      expect(beat.caption.length, `beat ${beat.id}`).toBeGreaterThan(0);
    }
  });

  it('el letrero del estudio sitúa lugar, momento y la confesión del doctor', () => {
    expect(EPILOGUE_CAPTIONS.study).toContain('estudio');
    expect(EPILOGUE_CAPTIONS.study).toContain('Utterson');
    expect(EPILOGUE_CAPTIONS.study).toContain('confesión');
  });

  it('el letrero de la niebla anuncia la niebla que crece alrededor del escritorio', () => {
    expect(EPILOGUE_CAPTIONS.fog).toContain('niebla');
    expect(EPILOGUE_CAPTIONS.fog).toContain('escritorio');
  });

  it('el letrero de la aparición cita el comic: «Pobre Henry» y Hyde detrás de él', () => {
    expect(EPILOGUE_CAPTIONS.emergence).toContain('Pobre Henry');
    expect(EPILOGUE_CAPTIONS.emergence).toContain('Hyde');
    expect(EPILOGUE_CAPTIONS.emergence.toLowerCase()).toContain('detrás');
  });

  it('la cartela de cierre es la viñeta final del comic VERBATIM', () => {
    expect(EPILOGUE_CAPTIONS.closing).toBe(
      'Nadie sabrá nunca el secreto del extraño caso del Dr. Jekyll y el Sr. Hyde.',
    );
    // El último beat es el que la muestra (la cartela cierra la obra).
    const last = EPILOGUE_BEATS[EPILOGUE_BEATS.length - 1];
    expect(last?.id).toBe(EpilogueBeatId.Closing);
    expect(last?.caption).toBe(EPILOGUE_CAPTIONS.closing);
  });

  it('la amenaza es SUGERIDA (sin léxico violento: tono 10+)', () => {
    const normalized = Object.values(EPILOGUE_CAPTIONS)
      .join(' ')
      .toLowerCase();
    // El corpus de content.test prohíbe las raíces violentas — here, guard
    // explícito del criterio del acto 2 de la intro: sin daño, sin contacto.
    for (const stem of ['sangr', 'muert', 'mata', 'asesin', 'golpe', 'tortur']) {
      expect(normalized.includes(stem), `stem «${stem}»`).toBe(false);
    }
  });
});

// ---- Parámetros de animación (los tweens viven en la escena) -------------------

describe('configs de animación por beat', () => {
  it('STUDY: fade positivo y pop de escala contenido (como la entrada de Jekyll)', () => {
    expect(EPILOGUE_STUDY.fadeMs).toBeGreaterThan(0);
    expect(EPILOGUE_STUDY.scaleFrom).toBeGreaterThan(0);
    expect(EPILOGUE_STUDY.scaleFrom).toBeLessThan(1);
  });

  it('FOG: velo de niebla con alfa que NO tapa el letrero y puffs crecientes', () => {
    expect(EPILOGUE_FOG.veil.alpha).toBeGreaterThan(0);
    expect(EPILOGUE_FOG.veil.alpha).toBeLessThanOrEqual(0.5);
    expect(EPILOGUE_FOG.veil.durationMs).toBeGreaterThan(0);
    expect(EPILOGUE_FOG.puffs.count).toBeGreaterThanOrEqual(3);
    expect(EPILOGUE_FOG.puffs.durationMs).toBeGreaterThan(0);
  });

  it('EMERGENCE: Hyde CRECE hasta GIGANTE y se ALZA (se aleja — jamás un acercamiento)', () => {
    const E = EPILOGUE_EMERGENCE;
    expect(E.delayMs).toBeGreaterThan(0);
    expect(E.fadeMs).toBeGreaterThan(0);
    expect(E.scaleTo).toBeGreaterThan(E.scaleFrom);
    // GIGANTE: muy por encima de la escala base de Utterson en pantalla.
    expect(E.scaleTo).toBeGreaterThan(EPILOGUE_SCENE_LAYOUT.utterson.scale);
    // La cara emerge desde abajo (las sombras) y SUBE: risePx > 0 significa
    // alejarse de Utterson; no hay ningún parámetro de acercamiento (x).
    expect(E.risePx).toBeGreaterThan(0);
    // Humo oscuro: 2–4 volutas con tinte `hydeSmoke`, subida serpenteante.
    expect(E.darkPuffs.count).toBeGreaterThanOrEqual(2);
    expect(E.darkPuffs.count).toBeLessThanOrEqual(4);
    expect(E.darkPuffs.color).toBe('#241a2e'); // hydeSmoke (casi negro)
    expect(E.darkPuffs.risePx).toBeGreaterThan(0);
    expect(E.darkPuffs.swayPx).toBeGreaterThan(0);
    expect(E.darkPuffs.swayPx).toBeLessThan(60);
    expect(E.darkPuffs.peakAlpha).toBeGreaterThan(0);
    expect(E.darkPuffs.peakAlpha).toBeLessThanOrEqual(0.7);
  });

  it('CLOSING: flash TENUE, respiración mínica de la cara y velo de sombra final', () => {
    const C = EPILOGUE_CLOSING;
    expect(C.flash.durationMs).toBeGreaterThan(0);
    expect(C.flash.peakAlpha).toBeGreaterThan(0);
    expect(C.flash.peakAlpha).toBeLessThanOrEqual(0.4); // tenue, no estrobo
    expect(C.breathe.scaleExtra).toBeGreaterThan(0);
    expect(C.breathe.scaleExtra).toBeLessThan(0.2); // respiración, no acecho
    expect(C.shadowVeil.alpha).toBeGreaterThan(0);
    expect(C.shadowVeil.alpha).toBeLessThanOrEqual(0.5); // el letrero se lee igual
    expect(C.shadowVeil.color).toBe('#241a2e'); // hydeSmoke
    expect(C.puffs.count).toBeGreaterThanOrEqual(3);
    expect(C.puffs.durationMs).toBeGreaterThan(0);
  });

  it('fogPuffTintFor alterna niebla cercana/media de forma determinista', () => {
    expect(fogPuffTintFor(0)).toBe(fogPuffTintFor(2));
    expect(fogPuffTintFor(1)).toBe(fogPuffTintFor(3));
    expect(fogPuffTintFor(0)).not.toBe(fogPuffTintFor(1));
  });
});

// ---- Layout (sobre el lienzo 720×1280) ------------------------------------------

describe('EPILOGUE_SCENE_LAYOUT — composición de la escena', () => {
  it('Utterson queda dentro del lienzo y por encima del letrero', () => {
    const { utterson, caption } = EPILOGUE_SCENE_LAYOUT;
    expect(utterson.x).toBeGreaterThan(0);
    expect(utterson.x).toBeLessThan(BASE_WIDTH);
    expect(utterson.y).toBeGreaterThan(0);
    expect(utterson.y).toBeLessThan(BASE_HEIGHT);
    expect(utterson.scale).toBeGreaterThan(0);
    expect(caption.y).toBeGreaterThan(utterson.y);
    expect(caption.y).toBeLessThan(BASE_HEIGHT);
  });

  it('Hyde queda DETRÁS de Utterson (depth menor) — la amenaza sin contacto', () => {
    const { hyde, utterson } = EPILOGUE_SCENE_LAYOUT;
    expect(hyde.depth).toBeLessThan(utterson.depth);
    expect(hyde.x).toBeGreaterThan(0);
    expect(hyde.x).toBeLessThan(BASE_WIDTH);
    expect(hyde.y).toBeLessThan(utterson.y); // asoma por encima del hombro
  });

  it('profundidades ordenadas: personajes < velo de niebla < letrero < flash', () => {
    const { utterson, caption, flashDepth, fogVeilDepth } = EPILOGUE_SCENE_LAYOUT;
    expect(fogVeilDepth).toBeGreaterThan(utterson.depth);
    expect(fogVeilDepth).toBeLessThan(caption.depth);
    expect(flashDepth).toBeGreaterThan(caption.depth);
  });

  it('el letrero es el MISMO formato que la intro (pergamino 640×150, wrap 560)', () => {
    const { caption } = EPILOGUE_SCENE_LAYOUT;
    expect(caption.panelWidth).toBe(640);
    expect(caption.panelHeight).toBe(150);
    expect(caption.style.wordWrapWidth).toBe(560);
    expect(caption.style.fontSize).toBe(32);
  });

  it('el botón «Saltar» reutiliza la etiqueta de la narrativa y queda dentro del lienzo', () => {
    const { skipButton } = EPILOGUE_SCENE_LAYOUT;
    expect(NARRATIVE_SKIP_BUTTON.label).toBe('Saltar');
    expect(skipButton.x).toBeGreaterThan(0);
    expect(skipButton.x).toBeLessThan(BASE_WIDTH);
    expect(skipButton.y).toBeGreaterThan(0);
    expect(skipButton.y).toBeLessThan(BASE_HEIGHT);
  });

  it('las flechas de navegación quedan al costado, dentro del lienzo', () => {
    const { nav } = EPILOGUE_SCENE_LAYOUT;
    expect(nav.marginX).toBeGreaterThan(0);
    expect(nav.marginX).toBeLessThan(BASE_WIDTH / 2);
    expect(nav.y).toBeGreaterThan(0);
    expect(nav.y).toBeLessThan(BASE_HEIGHT);
  });
});

// ---- Fondo del estudio (compuesto con texturas existentes) ----------------------

describe('EPILOGUE_BACKGROUND — el estudio de Utterson', () => {
  it('usa SOLO texturas registradas (sin hornada nueva)', () => {
    const registered = new Set<string>(Object.values(TEXTURE_KEYS));
    for (const layer of EPILOGUE_BACKGROUND.layers) {
      expect(registered.has(layer.key), `${layer.key} no está en TEXTURE_KEYS`).toBe(true);
    }
    for (const prop of EPILOGUE_BACKGROUND.props) {
      expect(registered.has(prop.key), `${prop.key} no está en TEXTURE_KEYS`).toBe(true);
    }
  });

  it('el escritorio es la mesa del lab teñida de silueta y el manuscrito es pergamino', () => {
    const [desk, manuscript] = EPILOGUE_BACKGROUND.props;
    expect(desk?.key).toBe(TEXTURE_KEYS.labBench);
    expect(desk?.tint).toBe('#1a1d24'); // buildings (silueta oscura)
    expect(manuscript?.key).toBe(TEXTURE_KEYS.parchmentFrame);
    // El manuscrito vive ENCIMA del tablero del escritorio.
    expect(manuscript?.depth).toBeGreaterThan(desk?.depth ?? 0);
  });

  it('es interior: sin estrellas y sin banda de calle', () => {
    expect(EPILOGUE_BACKGROUND.stars).toBeUndefined();
    expect(EPILOGUE_BACKGROUND.ground).toBeUndefined();
  });

  it('presupuesto de niebla (SPEC §10.4 ≤ 30): puffs transitorios + vela + slots del fondo', () => {
    const backgroundFogSlots = EPILOGUE_BACKGROUND.layers.reduce(
      (sum, layer) => sum + layer.slots.length,
      0,
    );
    // 4 (niebla creciente) + 4 (humo oscuro) + 4 (cierre) + 1 (vela) = 13.
    expect(epilogueFogSprites()).toBe(13);
    expect(backgroundFogSlots + epilogueFogSprites()).toBeLessThanOrEqual(30);
  });

  it('las texturas referenciadas por la escena están registradas', () => {
    const registered = new Set(Object.values(TEXTURE_KEYS));
    for (const key of Object.values(EPILOGUE_TEXTURES)) {
      expect(registered.has(key), `${key} no está en TEXTURE_KEYS`).toBe(true);
    }
    expect(EPILOGUE_TEXTURES.utterson).toBe('utterson');
    expect(EPILOGUE_TEXTURES.hyde).toBe('hyde');
    // El glow de la vela usa fuego de farola (cálido, sobre el manuscrito).
    expect(EPILOGUE_CANDLE.color).toBe('#e8b45a');
    expect(EPILOGUE_CANDLE.offsetY).toBeLessThan(0); // flota sobre la página
  });
});

// ---- Grafo del flujo: VICTORY final → EPILOGUE → MENU (niveles 1/2 intactos) ----

describe('flujo — VICTORY (final) → EPILOGUE → MENU', () => {
  it('NEXT_SCENE: VICTORY → EPILOGUE (cierre de la obra) y EPILOGUE → MENU', () => {
    expect(NEXT_SCENE[SceneKey.VICTORY]).toBe(SceneKey.EPILOGUE);
    expect(NEXT_SCENE[SceneKey.EPILOGUE]).toBe(SceneKey.MENU);
  });

  it('NEXT_SCENE está definida para TODAS las claves (sin huecos)', () => {
    for (const key of Object.values(SceneKey)) {
      expect(NEXT_SCENE[key], `NEXT_SCENE[${key}]`).toBeDefined();
    }
  });

  it('la arista defensiva de victorias NO finales queda documentada en ALT_TRANSITIONS', () => {
    expect(ALT_TRANSITIONS.victoryEarlyLevels).toEqual({
      from: SceneKey.VICTORY,
      to: SceneKey.MENU,
    });
  });

  it('victoryExitTarget: SOLO el nivel FINAL (sin N+1) deriva al EPILOGUE', () => {
    expect(victoryExitTarget(3)).toBe(SceneKey.EPILOGUE);
    expect(victoryExitTarget(99)).toBe(SceneKey.EPILOGUE); // sin nivel siguiente = final
  });

  it('REGRESIÓN (niveles 1 y 2 intactos): una victoria temprana iría directo a MENU', () => {
    expect(victoryExitTarget(1)).toBe(SceneKey.MENU);
    expect(victoryExitTarget(2)).toBe(SceneKey.MENU);
    // Y el resto del grafo no cambió: la progresión multi-nivel sigue igual.
    for (const level of LEVELS) {
      if (hasNextLevel(level.id)) {
        expect(victoryExitTarget(level.id), `nivel ${level.id}`).toBe(SceneKey.MENU);
      } else {
        expect(victoryExitTarget(level.id), `nivel ${level.id}`).toBe(SceneKey.EPILOGUE);
      }
    }
  });

  it('«Jugar de nuevo» NO pasa por el epílogo: NARRATIVE {1} sigue siendo su destino', () => {
    expect(NEXT_SCENE[SceneKey.EPILOGUE]).toBe(SceneKey.MENU);
    expect(ALT_TRANSITIONS.quizWrong).toEqual({ from: SceneKey.QUIZ, to: SceneKey.NARRATIVE });
  });
});

// ---- EpilogueScene — wiring leído como fuente (jsdom no puede cargar Phaser) ----

describe('EpilogueScene — wiring de la máquina de beats (leído como fuente)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/scenes/EpilogueScene.ts'), 'utf8');

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

  it('tiene players para los CUATRO beats (Record exhaustivo por tipos)', () => {
    expect(source).toContain('[EpilogueBeatId.Study]: (beat) => this.playStudy(beat)');
    expect(source).toContain('[EpilogueBeatId.Fog]: (beat) => this.playFog(beat)');
    expect(source).toContain('[EpilogueBeatId.Emergence]: (beat) => this.playEmergence(beat)');
    expect(source).toContain('[EpilogueBeatId.Closing]: (beat) => this.playClosing(beat)');
  });

  it('la aparición de Hyde: thump, fade + CRECIMIENTO + alzarse, con humo oscuro en beatFx', () => {
    expect(source).toContain('this.audioSystem.thump()');
    expect(source).toContain('this.spawnEmergenceSmoke()');
    expect(source).toMatch(
      /private spawnEmergenceSmoke\(\): void[\s\S]*?EPILOGUE_EMERGENCE\.darkPuffs[\s\S]*?this\.beatFx\.push\(puff\)/,
    );
    // Fade + crecimiento (hasta GIGANTE) + alzamiento, todo con delay del beat.
    expect(source).toMatch(
      /private playEmergence\([\s\S]*?scale: \{ from: hyde\.scale \* E\.scaleFrom, to: hyde\.scale \* E\.scaleTo \}/,
    );
    expect(source).toMatch(
      /private playEmergence\([\s\S]*?y: \{ from: startY, to: hyde\.y \}/,
    );
  });

  it('la amenaza es SIN CONTACTO: Hyde nace DETRÁS (depth menor) y jamás se desplaza hacia Utterson', () => {
    // Hyde se construye con el depth del layout (menor que el de Utterson).
    expect(source).toMatch(
      /private buildActors\(\): void[\s\S]*?this\.hyde = this\.add[\s\S]*?\.setDepth\(hyde\.depth\)/,
    );
    // En el cierre, la cara SOLO respira (escala en yoyo): ningún tween de
    // posición de Hyde en el beat «Closing» — no hay acercamiento posible.
    const closingBlock = source.slice(source.indexOf('private playClosing('));
    expect(closingBlock).toContain('targets: this.hyde');
    expect(closingBlock).not.toMatch(/targets: this\.hyde,[\s\S]*?x:/);
    expect(closingBlock).not.toMatch(/targets: this\.hyde,[\s\S]*?setPosition/);
  });

  it('el cierre tiene el flash tenue (yoyo), el velo de sombra y la salida ÚNICA con wipe a MENU', () => {
    expect(source).toContain('this.spawnClosingPuffs()');
    expect(source).toMatch(/alpha: \{ from: 0, to: C\.flash\.peakAlpha \}/);
    expect(source).toMatch(/yoyo: true,[\s\S]*?ease: 'Sine\.easeInOut',[\s\S]*?\}\);[\s\S]*?2\) Velo extra/);
    // Un único punto de salida (exitToMenu con guard propio), SIEMPRE a MENU.
    expect(source).toContain('wipeTo(this, SceneKey.MENU)');
    expect(source.match(/wipeTo\(/g)?.length).toBe(1);
  });

  it('navegación UNIFICADA con la intro: flechas al costado, «atrás» re-entra al beat anterior', () => {
    expect(source).toContain('private buildNavArrows(): void');
    expect(source).toMatch(/private prevArrow!: Phaser\.GameObjects\.Image/);
    expect(source).toMatch(/private nextArrow!: Phaser\.GameObjects\.Image/);
    expect(source).toMatch(
      /private onNavBack\(\): void[\s\S]*?this\.clearBeatFx\(\);[\s\S]*?this\.enterBeat\(this\.beatIndex - 1\);/,
    );
    expect(source).toMatch(/private onNavForward\(\): void[\s\S]*?this\.onTap\(\);/);
    expect(source).toMatch(/private enterBeat\([\s\S]*?this\.updateNavArrows\(\);/);
  });

  it('usa fadeIn, fondo de noche, el botón «Saltar» de la narrativa y el wind/thump/blip del audio', () => {
    expect(source).toContain('fadeIn(this)');
    expect(source).toContain('setBackgroundColor(nightBackground)');
    expect(source).toContain('NARRATIVE_SKIP_BUTTON');
    expect(source).toMatch(/if \(audioSystem\.isUnlocked\) \{[\s\S]*?audioSystem\.wind\(\)/);
    expect(source).toContain('this.audioSystem.wind(1.6)');
  });

  it('el fondo se construye desde EPILOGUE_BACKGROUND (un solo escenario, sin trocas) y la vela titila', () => {
    expect(source).toContain('this.buildBackground(EPILOGUE_BACKGROUND)');
    expect(source).toContain('new ParallaxField(');
    expect(source).toContain('this.spawnCandleGlow()');
    // Sin ensureBackground: el estudio no cambia durante el epílogo.
    expect(source).not.toContain('ensureBackground');
    // La vela titila por frame con lampFlicker (luz del cuarto, no FX de beat).
    expect(source).toContain('lampFlicker(t + prop.phase, 0.72, 1.6)');
  });

  it('cada player normaliza a Utterson (entero) y a Hyde (oculto hasta su beat)', () => {
    expect(source.match(/this\.utterson\s*\.setVisible\(true\)/g)?.length).toBe(4);
    expect(source).toContain('this.hyde.setVisible(false).setAlpha(0)');
    expect(source.match(/this\.hyde\s*\.setVisible\(true\)/g)?.length).toBe(2);
  });

  it('los players no usan delayedCall propios (solo tweens: clearBeatFx los mata)', () => {
    // ÚNICA llamada real: el timer de auto-avance del beat (las menciones en
    // comentarios no cuentan).
    expect(source.match(/this\.time\.delayedCall/g)?.length).toBe(1);
    expect(source).toContain('this.time.delayedCall(beat.durationMs');
  });
});

// ---- Trigger: VictoryScene solo deriva al epílogo en la victoria final ----------

describe('VictoryScene — trigger del epílogo (solo victoria final, leído como fuente)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/scenes/VictoryScene.ts'), 'utf8');

  it('«Volver al inicio» decide el destino con victoryExitTarget(level.id) — puro y testeado', () => {
    expect(source).toContain('transitionTo(this, victoryExitTarget(this.level.id))');
  });

  it('el resto de las salidas de VICTORY queda intacto (rejugar → NARRATIVE {1})', () => {
    const playBlock = source.slice(source.indexOf('private onPlayAgain('));
    expect(playBlock).toContain('scoreSystem.reset()');
    expect(playBlock).toContain('setCurrentLevel(FIRST_LEVEL_ID)');
    expect(playBlock).toContain(
      'transitionTo(this, SceneKey.NARRATIVE, { levelId: FIRST_LEVEL_ID })',
    );
    // El epílogo NO interfiere con la marca de save (una vez por entrada).
    expect(source).toContain('markLevelComplete(finalScore, this.level.id)');
  });
});
