/**
 * Etapa 5 — test de fuente de QuizScene, OptionCard y Modal (estilo
 * actionScene.test.ts: se lee el ARCHIVO como fuente porque importarlo
 * cargaría Phaser y jsdom no puede). Se valida el wiring de la capa fina:
 * consume el reducer/layout puros de gameplay/quizState, aplica el +100 con
 * arpegio en la rama correcta, resetea la tanda ANTES de volver a NARRATIVE
 * en la incorrecta (D5), pasa {levelId} en ambas salidas, muestra SOLO el
 * puntaje (sin timer) y nunca ofrece cerrar el modal sin feedback.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const quizSource = readFileSync(resolve(projectRoot, 'src/scenes/QuizScene.ts'), 'utf8');
const cardSource = readFileSync(resolve(projectRoot, 'src/ui/OptionCard.ts'), 'utf8');
const modalSource = readFileSync(resolve(projectRoot, 'src/ui/Modal.ts'), 'utf8');
const quizStateSource = readFileSync(resolve(projectRoot, 'src/gameplay/quizState.ts'), 'utf8');

describe('QuizScene — consume los módulos PUROS (arquitectura Etapa 5)', () => {
  it('el estado lo decide el reducer quizReducer (nada de lógica inline)', () => {
    expect(quizSource).toContain('quizReducer');
    expect(quizSource).toContain('initialQuizState');
    expect(quizSource).toContain('QuizEventType.Select');
    expect(quizSource).toContain('QuizEventType.ContinueWrong');
    expect(quizSource).toContain('QuizEventType.ContinueStory');
    expect(quizSource).toContain('QuizPhase.Story');
    expect(quizSource).toContain('QuizPhase.Done');
  });

  it('la composición de vistas la calcula quizBoardLayout (layout puro, datos)', () => {
    expect(quizSource).toContain('quizBoardLayout(');
    expect(quizSource).toContain('this.board.question');
    expect(quizSource).toContain('this.board.feedback');
    expect(quizSource).toContain('this.board.story');
  });

  it('nivel activo por scene-start data {levelId} (genérica, como NARRATIVE/ACTION)', () => {
    expect(quizSource).toContain('activeLevelFor(data.levelId)');
    expect(quizSource).toContain('interface QuizSceneData');
  });

  it('la opción correcta se detecta del DATO del nivel (no hardcodeada)', () => {
    expect(quizSource).toContain('option.correct === true');
    // Nunca un índice literal de opción correcta en la escena.
    expect(quizSource).not.toMatch(/correctIndex\s*=\s*1\b/);
  });

  it('el modal se compone con ui/Modal + ui/Panel (pergamino claro) y OptionCard', () => {
    expect(quizSource).toContain('new Modal(');
    expect(quizSource).toContain('new OptionCard(');
    expect(quizSource).toContain('QUIZ_PANEL_STYLE');
    // El estilo del marco de la carta es el sepia CLARO de la paleta.
    expect(quizStateSource).toMatch(/QUIZ_PANEL_STYLE[\s\S]*?fill:\s*parchmentLight/);
    expect(quizStateSource).toMatch(/QUIZ_PANEL_STYLE[\s\S]*?stroke:\s*parchmentDark/);
  });

  it('los rótulos vienen de los DATOS (wrongFeedbackHeader + QUIZ_LABELS)', () => {
    expect(quizSource).toContain('wrongFeedbackHeader(selected)');
    expect(quizSource).toContain('QUIZ_LABELS.restartLevel');
    expect(quizSource).toContain('QUIZ_LABELS.continueStory');
  });

  it('cada fase pinta SU vista y la fase done no pinta nada (renderView)', () => {
    const renderBlock = quizSource.slice(quizSource.indexOf('private renderView('));
    expect(renderBlock.indexOf('buildQuestionView()')).toBeGreaterThan(-1);
    expect(renderBlock.indexOf('buildFeedbackView()')).toBeGreaterThan(-1);
    expect(renderBlock.indexOf('buildStoryView()')).toBeGreaterThan(-1);
    expect(renderBlock.indexOf('return; // terminal')).toBeGreaterThan(-1);
  });
});

describe('QuizScene — rama correcta (SPEC §4.3/§5/§8: +100 → arpegio → historia → VICTORY)', () => {
  it('Select con acierto: scoreSystem.add(QUIZ_POINTS, quiz) (+100) + arpeggio()', () => {
    const selectBlock = quizSource.slice(quizSource.indexOf('private onSelect('));
    expect(selectBlock.indexOf('next.phase === QuizPhase.Story')).toBeGreaterThan(-1);
    expect(selectBlock.indexOf('scoreSystem.add(QUIZ_POINTS, SCORE_CATEGORY.quiz)')).toBeGreaterThan(-1);
    expect(selectBlock.indexOf('audioSystem.arpeggio()')).toBeGreaterThan(-1);
    // El +100 lo aplica la escena ANTES del arpegio (orden del SPEC: +100 → arpegio).
    expect(selectBlock.indexOf('scoreSystem.add(QUIZ_POINTS, SCORE_CATEGORY.quiz)')).toBeLessThan(
      selectBlock.indexOf('audioSystem.arpeggio()'),
    );
  });

  it('el +100 vale exactamente 100 (SPEC §5) y vive en gameplay/scoring', () => {
    const scoringSource = readFileSync(resolve(projectRoot, 'src/gameplay/scoring.ts'), 'utf8');
    expect(scoringSource).toContain('export const QUIZ_POINTS = 100');
    expect(quizSource).toContain("from '../gameplay/scoring'");
  });

  it('«Continuar» → transición a VICTORY pasando {levelId}', () => {
    expect(quizSource).toContain('transitionTo(this, SceneKey.VICTORY, { levelId: this.level.id })');
  });

  it('la vista historia renderiza el storyFragment REAL del nivel (carta antigua)', () => {
    const storyBlock = quizSource.slice(quizSource.indexOf('private buildStoryView('));
    expect(storyBlock.indexOf('quiz.storyFragment')).toBeGreaterThan(-1);
    expect(storyBlock.indexOf('buildModal(')).toBeGreaterThan(-1);
  });
});

describe('QuizScene — rama incorrecta (D5: feedback de ESA opción → reinicio del nivel)', () => {
  it('Select con fallo: errorSound() (intervalo menor descendente, SPEC §8)', () => {
    const selectBlock = quizSource.slice(quizSource.indexOf('private onSelect('));
    expect(selectBlock.indexOf('audioSystem.errorSound()')).toBeGreaterThan(-1);
  });

  it('«Volver a empezar el nivel» → reducer (ContinueWrong) → restartLevel()', () => {
    const continueBlock = quizSource.slice(quizSource.indexOf('private onContinueWrong('));
    expect(continueBlock.indexOf('QuizEventType.ContinueWrong')).toBeGreaterThan(-1);
    expect(continueBlock.indexOf('this.restartLevel()')).toBeGreaterThan(-1);
  });

  it('restartLevel: scoreSystem.reset() ANTES de volver a NARRATIVE (descarte de tanda, D5)', () => {
    const restartBlock = quizSource.slice(quizSource.indexOf('private restartLevel('));
    const resetAt = restartBlock.indexOf('scoreSystem.reset()');
    const transitionAt = restartBlock.indexOf('transitionTo(this, SceneKey.NARRATIVE');
    expect(resetAt).toBeGreaterThan(-1);
    expect(transitionAt).toBeGreaterThan(-1);
    expect(resetAt).toBeLessThan(transitionAt);
  });

  it('el save MANTIENE inProgress=true al reiniciar (SPEC §11, idempotente)', () => {
    const restartBlock = quizSource.slice(quizSource.indexOf('private restartLevel('));
    expect(restartBlock.indexOf('setInProgress(true)')).toBeGreaterThan(-1);
  });

  it('el reinicio va a NARRATIVE (nivel completo) pasando {levelId}', () => {
    expect(quizSource).toContain('transitionTo(this, SceneKey.NARRATIVE, { levelId: this.level.id })');
  });

  it('la vista feedback muestra el feedback de la opción ELEGIDA (no otro)', () => {
    const feedbackBlock = quizSource.slice(quizSource.indexOf('private buildFeedbackView('));
    expect(feedbackBlock.indexOf('this.state.selected')).toBeGreaterThan(-1);
    expect(feedbackBlock.indexOf("quiz.options[selected]")).toBeGreaterThan(-1);
    // Estilo de error desaturado (palette.error) en rótulo y texto.
    expect(feedbackBlock.indexOf('feedback.color')).toBeGreaterThan(-1);
  });

  it('tras responder se DESHABILITAN todas las tarjetas (estado visible, PLAN Etapa 5)', () => {
    const selectBlock = quizSource.slice(quizSource.indexOf('private onSelect('));
    expect(selectBlock.indexOf('setDisabled(true)')).toBeGreaterThan(-1);
    expect(selectBlock.indexOf('for (const card of this.cards)')).toBeGreaterThan(-1);
    // El cambio de vista espera cardLockMs (se VE la tarjeta bloqueada).
    expect(selectBlock.indexOf('cardLockMs')).toBeGreaterThan(-1);
    expect(selectBlock.indexOf('delayedCall')).toBeGreaterThan(-1);
  });

  it('todas las tarjetas quedan deshabilitadas tras responder ( SPEC §6)', () => {
    // El reducer saca la escena de question tras UN select; OptionCard corta
    // su input con setDisabled (la vista se reconstruye por fase).
    expect(cardSource).toContain('setDisabled(disabled: boolean)');
    expect(cardSource).toContain('disableInteractive()');
    expect(quizStateSource).toMatch(/if \(state\.phase !== QuizPhase\.Question\)/);
  });
});

describe('QuizScene — «nunca se cierra sin feedback» + guard de salida (SPEC §6)', () => {
  it('el modal NO tiene botón de cierre ni «Saltar»: solo salen las fases con feedback', () => {
    expect(quizSource).not.toMatch(/Saltar|Cerrar|close/i);
  });

  it('guard `exiting` anti doble-tap en las salidas', () => {
    expect(quizSource).toContain('this.exiting');
    const restartBlock = quizSource.slice(quizSource.indexOf('private restartLevel('));
    expect(restartBlock.indexOf('if (this.exiting)')).toBeGreaterThan(-1);
  });

  it('limpieza al apagar la escena: baja de score:change y destruye el modal', () => {
    const shutdownBlock = quizSource.slice(quizSource.indexOf('Phaser.Scenes.Events.SHUTDOWN'));
    expect(shutdownBlock.indexOf('unsubscribeScore')).toBeGreaterThan(-1);
    expect(shutdownBlock.indexOf('modal?.destroy()')).toBeGreaterThan(-1);
  });
});

describe('QuizScene — HUD: SOLO puntaje, sin timer (SPEC §5/§6 en el quiz)', () => {
  it('score vivo por los eventos score:change del ScoreSystem', () => {
    expect(quizSource).toContain('scoreSystem.onChange');
    expect(quizSource).toContain('Puntaje: ');
  });

  it('NO arrastra TimerBar ni el Hud de acción (el quiz no tiene timer)', () => {
    expect(quizSource).not.toContain('TimerBar');
    expect(quizSource).not.toContain('new Hud(');
  });
});

describe('OptionCard — patrón GothicButton/buttonState (fuente)', () => {
  it('usa la máquina de estados PURA nextButtonState (sin duplicar lógica)', () => {
    expect(cardSource).toContain('nextButtonState');
    expect(cardSource).toContain('ButtonPointerEvent');
    expect(cardSource).toContain('ButtonVisualState');
  });

  it('letra de opción vía optionLabel (A–D desde el módulo puro)', () => {
    expect(cardSource).toContain('optionLabel(config.index)');
  });

  it('hitbox explícita del tamaño de la tarjeta (containers sin hit area propia)', () => {
    expect(cardSource).toContain('hitArea: new Phaser.Geom.Rectangle');
    expect(cardSource).toContain('Phaser.Geom.Rectangle.Contains');
  });

  it('onPress SOLO al soltar sobre una tarjeta pressed y habilitada (patrón GothicButton)', () => {
    expect(cardSource).toContain('wasPressed && !this.disabled');
    expect(cardSource).toContain('POINTER_UP_OUTSIDE');
  });

  it('estado deshabilitado: atenúa con disabledAlpha y corta el input (SPEC §6)', () => {
    expect(cardSource).toContain('setAlpha(disabledAlpha)');
    expect(cardSource).toContain('disableInteractive()');
  });

  it('texto de la opción con wrap de Phaser al ancho del layout puro', () => {
    expect(cardSource).toContain('wordWrap: { width: config.textWrapWidth');
  });
});

describe('Modal — velo + carta pergamino + capa de contenido (fuente)', () => {
  it('compone Panel (marco) sobre un velo del color de noche a tamaño de lienzo', () => {
    expect(modalSource).toContain('new Panel(');
    expect(modalSource).toContain('BASE_WIDTH');
    expect(modalSource).toContain('BASE_HEIGHT');
    expect(modalSource).toContain('hexToNumber(options.veil.color)');
  });

  it('expone la capa de contenido y destruye TODO (velo, marco, contenido)', () => {
    expect(modalSource).toContain('readonly content: Phaser.GameObjects.Container');
    const destroyBlock = modalSource.slice(modalSource.indexOf('destroy(): void'));
    expect(destroyBlock.indexOf('content.destroy()')).toBeGreaterThan(-1);
    expect(destroyBlock.indexOf('panel.destroy()')).toBeGreaterThan(-1);
    expect(destroyBlock.indexOf('veil.destroy()')).toBeGreaterThan(-1);
  });
});
