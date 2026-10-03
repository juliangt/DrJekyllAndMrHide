/**
 * Etapa 6 — test de fuente de VictoryScene (estilo quizScene.test.ts: se lee
 * el ARCHIVO como fuente porque importarlo cargaría Phaser y jsdom no puede).
 * Se valida el wiring de la capa fina: consume los módulos PUROS de
 * gameplay/victory + ui/nameField, marca el save UNA vez con guard (y lee el
 * récord PREVIO antes de marcar), suena el arpegio al entrar, los botones
 * transicionan según el PLAN («Jugar de nuevo» resetea la tanda ANTES de ir a
 * NARRATIVE; «Volver al inicio» va a MENU), usa el sello de cera y limpia el
 * input DOM en SHUTDOWN.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const source = readFileSync(resolve(projectRoot, 'src/scenes/VictoryScene.ts'), 'utf8');
const victorySource = readFileSync(resolve(projectRoot, 'src/gameplay/victory.ts'), 'utf8');
const nameFieldSource = readFileSync(resolve(projectRoot, 'src/ui/nameField.ts'), 'utf8');

describe('VictoryScene — consume los módulos PUROS (arquitectura Etapa 6)', () => {
  it('el desglose lo calcula buildScoreBreakdown con las cubetas del ScoreSystem', () => {
    expect(source).toContain('buildScoreBreakdown(');
    expect(source).toContain('getBreakdown()');
    // El bonus de la placa viene de la cubeta time-bonus del desglose.
    expect(source).toContain('bonus: raw.timeBonus');
  });

  it('el texto del diploma viene de diplomaText (nombre en línea fija del módulo puro)', () => {
    expect(source).toContain('diplomaText(this.rawName');
    expect(victorySource).toContain('export function diplomaText');
    expect(victorySource).toContain('export const NAME_LINE_INDEX');
  });

  it('el rótulo del récord viene de recordLabel + isNewRecord (módulo puro)', () => {
    expect(source).toContain('recordLabel(finalScore, previousRecord)');
    expect(source).toContain('isNewRecord(finalScore, previousRecord)');
  });

  it('el layout y las etiquetas son DATOS de gameplay/victory (sin números mágicos)', () => {
    expect(source).toContain('VICTORY_LAYOUT');
    expect(source).toContain('VICTORY_LABELS');
    expect(source).toContain('VICTORY_BUTTON');
    expect(source).toContain('VICTORY_PANEL_STYLE');
  });

  it('nivel activo por scene-start data {levelId} (genérica, como QUIZ)', () => {
    expect(source).toContain('activeLevelFor(data.levelId)');
    expect(source).toContain('interface VictorySceneData');
  });

  it('reutiliza ui/Modal (velo + pergamino claro, estilo carta del quiz) y GothicButton', () => {
    expect(source).toContain('new Modal(');
    expect(source).toContain('new GothicButton(');
  });
});

describe('VictoryScene — save del SPEC §11 (una sola vez, con guard)', () => {
  it('marca markLevelComplete con el score final y el levelId', () => {
    expect(source).toContain('markLevelComplete(finalScore, this.level.id)');
  });

  it('guard anti-reentrado: el marcado ocurre UNA vez por entrada', () => {
    expect(source).toContain('this.saveMarked');
    const markBlock = source.slice(source.indexOf('private markCompletionOnce('));
    expect(markBlock.indexOf('if (this.saveMarked)')).toBeGreaterThan(-1);
    expect(markBlock.indexOf('this.saveMarked = true')).toBeGreaterThan(-1);
    // El guard se resetea por entrada en init (una marca por entrada real).
    const initBlock = source.slice(source.indexOf('init(data'), source.indexOf('create(): void'));
    expect(initBlock.indexOf('this.saveMarked = false')).toBeGreaterThan(-1);
  });

  it('lee el récord PREVIO (lastScore) ANTES de marcar el save (decide «¡Nuevo récord!»)', () => {
    const createBlock = source.slice(source.indexOf('create(): void'), source.indexOf('update(time'));
    const lastScoreAt = createBlock.indexOf('saveSystem.lastScore');
    const markAt = createBlock.indexOf('markCompletionOnce(');
    expect(lastScoreAt).toBeGreaterThan(-1);
    expect(markAt).toBeGreaterThan(-1);
    expect(lastScoreAt).toBeLessThan(markAt);
  });
});

describe('VictoryScene — botones del PLAN (rejugar / inicio)', () => {
  it('«Jugar de nuevo»: scoreSystem.reset() ANTES de volver a NARRATIVE con {levelId}', () => {
    const playBlock = source.slice(source.indexOf('private onPlayAgain('));
    const resetAt = playBlock.indexOf('scoreSystem.reset()');
    const transitionAt = playBlock.indexOf("transitionTo(this, SceneKey.NARRATIVE, { levelId: this.level.id })");
    expect(resetAt).toBeGreaterThan(-1);
    expect(transitionAt).toBeGreaterThan(-1);
    expect(resetAt).toBeLessThan(transitionAt);
  });

  it('«Volver al inicio»: transición a MENU (sin «Continuar» tras ganar, SPEC §6/§11)', () => {
    const menuBlock = source.slice(source.indexOf('private onBackToMenu('));
    expect(menuBlock.indexOf('transitionTo(this, SceneKey.MENU)')).toBeGreaterThan(-1);
  });

  it('guard `exiting` anti doble-tap en ambas salidas', () => {
    expect(source).toContain('this.exiting');
    expect(source.match(/if \(this\.exiting\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('VictoryScene — sonido y ciclo de vida', () => {
  it('suena el arpegio al entrar (fanfarria corta, SPEC §8)', () => {
    expect(source).toContain('audioSystem.arpeggio()');
  });

  it('la firma DOM se crea solo al tocar la zona y se destruye en SHUTDOWN', () => {
    expect(source).toContain('new NameField(');
    const shutdownBlock = source.slice(source.indexOf('Phaser.Scenes.Events.SHUTDOWN'));
    expect(shutdownBlock.indexOf('nameField?.destroy()')).toBeGreaterThan(-1);
    expect(shutdownBlock.indexOf('modal?.destroy()')).toBeGreaterThan(-1);
  });

  it('la zona de firma es interactiva y el commit refresca el diploma', () => {
    expect(source).toContain('this.onSignerTap()');
    const commitBlock = source.slice(source.indexOf('private commitName('));
    expect(commitBlock.indexOf('refreshDiploma()')).toBeGreaterThan(-1);
  });
});

describe('nameField — approach DOM sobre el canvas (decision documentada)', () => {
  it('mapea coords de juego a CSS replicando Scale.FIT + CENTER_BOTH', () => {
    expect(nameFieldSource).toContain('export function canvasPointToCss');
    expect(nameFieldSource).toContain('Math.min(safeRect.width / baseWidth');
  });

  it('el input nace oculto y destroy() lo retira del DOM (sin huérfanos al cambiar de escena)', () => {
    expect(nameFieldSource).toContain("input.style.display = 'none'");
    const destroyBlock = nameFieldSource.slice(nameFieldSource.indexOf('destroy(): void'));
    expect(destroyBlock.indexOf("removeEventListener('resize'")).toBeGreaterThan(-1);
    expect(destroyBlock.indexOf('this.element.remove()')).toBeGreaterThan(-1);
  });
});
