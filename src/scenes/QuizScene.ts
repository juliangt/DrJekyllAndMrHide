/**
 * QUIZ (SPEC §3, §4.3, §4.4 / PLAN Etapa 5): escena GENÉRICA que renderiza
 * el `QuizConfig` del nivel activo — modal de carta pergamino CLARO centrado
 * (SPEC §6) con la pregunta, 4 tarjetas-opción (A–D) y feedback SIEMPRE.
 *
 * ARQUITECTURA: capa fina sobre módulos PUROS — TODO el estado lo decide el
 * reducer `quizReducer` (gameplay/quizState), el layout/posiciones/estilos
 * son DATOS calculados por `quizBoardLayout` (misma garantía «nunca desborda»
 * que la narrativa), y las letras/rotulos vienen de `optionLabel` /
 * `wrongFeedbackHeader`. Reglas:
 *
 *  - Nivel activo por scene-start data `{ levelId }` (desde ACTION, default 1).
 *  - Opción CORRECTA → `scoreSystem.add(QUIZ_POINTS)` (+100, SPEC §5) →
 *    arpegio mayor (SPEC §8) → carta antigua con `storyFragment` (SPEC §4.4)
 *    → «Continuar» → VICTORY con {levelId}.
 *  - Opción INCORRECTA → se deshabilitan TODAS las tarjetas → intervalo
 *    menor descendente (SPEC §8) → feedback pedagógico de ESA opción en
 *    placa de error desaturado → «Volver a empezar el nivel» →
 *    `scoreSystem.reset()` (D5: descarte de la tanda) → NARRATIVE con
 *    {levelId} (skip disponible allí). El save MANTIENE `inProgress = true`.
 *  - «Nunca se cierra sin feedback» (SPEC §6): el modal no tiene cierre; las
 *    únicas salidas pasan por las fases `feedback-wrong` / `story` del
 *    reducer (estructura de fases lo garantiza, testeada).
 *  - HUD: SOLO el puntaje (sin barra de tiempo — SPEC §5/§6), vivo por los
 *    eventos `score:change` del ScoreSystem (incluye el reset del reinicio D5).
 */
import Phaser from 'phaser';
import { activeLevelFor } from '../config/narrative';
import { hexToNumber, nightBackground } from '../config/palette';
import { SceneKey } from '../config/sceneKeys';
import { getSystems } from '../systems/getSystems';
import { SCORE_CATEGORY } from '../systems/ScoreSystem';
import type { AudioSystem } from '../systems/AudioSystem';
import type { SaveSystem } from '../systems/SaveSystem';
import type { ScoreSystem } from '../systems/ScoreSystem';
import type { LevelConfig } from '../config/levels/types';
import { QUIZ_POINTS } from '../gameplay/scoring';
import {
  QUIZ_ACTION_BUTTON,
  QUIZ_LABELS,
  QUIZ_LAYOUT,
  QUIZ_PANEL_STYLE,
  QuizEventType,
  QuizPhase,
  initialQuizState,
  quizBoardLayout,
  quizReducer,
  wrongFeedbackHeader,
  type QuizBoardLayout,
  type QuizState,
} from '../gameplay/quizState';
import { fadeIn, transitionTo } from './sceneNav';
import { Modal } from '../ui/Modal';
import { OptionCard } from '../ui/OptionCard';
import { GothicButton } from '../ui/GothicButton';

/** Datos de arranque (`scene.start(QUIZ, data)`), desde ACTION. */
export interface QuizSceneData {
  levelId?: number;
}

export class QuizScene extends Phaser.Scene {
  private level!: LevelConfig;
  private state!: QuizState;
  private board!: QuizBoardLayout;
  private systems!: { saveSystem: SaveSystem; audioSystem: AudioSystem; scoreSystem: ScoreSystem };
  private modal: Modal | null = null;
  private scoreText: Phaser.GameObjects.Text | null = null;
  private unsubscribeScore: (() => void) | null = null;
  /** Tarjetas de la vista pregunta activa (para deshabilitarlas al responder). */
  private cards: OptionCard[] = [];
  /** True cuando ya se disparó la salida (anti doble tap / doble botón). */
  private exiting = false;

  constructor() {
    super(SceneKey.QUIZ);
  }

  init(data: QuizSceneData = {}): void {
    this.level = activeLevelFor(data.levelId);
    const quiz = this.level.quiz;

    // La opción correcta (exactamente una, validado en levels.test). Una
    // config rota degrada a la primera opción (initialQuizState clampea).
    const found = quiz.options.findIndex((option) => option.correct === true);
    const correctIndex = found >= 0 ? found : 0;
    this.state = initialQuizState({ optionCount: quiz.options.length, correctIndex });

    // Composición pura de las tres vistas con los textos REALES del nivel.
    this.board = quizBoardLayout({
      question: quiz.question,
      optionTexts: quiz.options.map((option) => option.text),
      wrongFeedbacks: quiz.options
        .filter((_, index) => index !== correctIndex)
        .map((option) => option.feedback),
      correctFeedback: quiz.options[correctIndex]?.feedback ?? '',
      storyFragment: quiz.storyFragment,
    });

    this.exiting = false;
    this.modal = null;
    this.cards = [];
    this.scoreText = null;
    this.unsubscribeScore = null;
  }

  create(): void {
    this.systems = getSystems(this);
    fadeIn(this);
    this.cameras.main.setBackgroundColor(nightBackground);

    this.buildScoreHud();
    this.renderView(false);

    // La suscripción al ScoreSystem muere con la escena.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeScore?.();
      this.unsubscribeScore = null;
      this.modal?.destroy();
      this.modal = null;
    });
  }

  // ---- HUD de puntaje (sin timer en el quiz, SPEC §5/§6) ----------------------

  private buildScoreHud(): void {
    const { score, depths } = QUIZ_LAYOUT;
    this.scoreText = this.add
      .text(score.x, score.y, this.scoreLabel(this.systems.scoreSystem.getScore()), {
        fontFamily: score.fontFamily,
        fontSize: `${score.fontSize}px`,
        color: score.color,
      })
      .setOrigin(0, 0.5)
      .setDepth(depths.score)
      .setShadow(0, 2, '#0d0f14', 6);

    // Puntaje vivo: el +100 del acierto y el reset del reinicio (D5) llegan
    // por el evento `score:change` — la escena no empuja nada a mano.
    this.unsubscribeScore = this.systems.scoreSystem.onChange((payload) => {
      this.scoreText?.setText(this.scoreLabel(payload.score));
    });
  }

  private scoreLabel(score: number): string {
    return `Puntaje: ${score}`;
  }

  // ---- Vistas por fase (el reducer decide siempre) -----------------------------

  /** Reconstruye el modal según la fase actual del reducer. */
  private renderView(animated: boolean): void {
    this.modal?.destroy();
    this.cards = [];
    let modal: Modal | null = null;
    switch (this.state.phase) {
      case QuizPhase.Question:
        modal = this.buildQuestionView();
        break;
      case QuizPhase.FeedbackWrong:
        modal = this.buildFeedbackView();
        break;
      case QuizPhase.Story:
        modal = this.buildStoryView();
        break;
      case QuizPhase.Done:
        return; // terminal: la escena ya navega; nada que pintar
    }
    this.modal = modal;
    if (animated && modal) {
      this.tweens.add({
        targets: modal.content,
        alpha: { from: 0, to: 1 },
        duration: QUIZ_LAYOUT.fade.inMs,
        ease: 'Sine.easeOut',
      });
    }
  }

  /** Vista pregunta: pregunta + 4 tarjetas-opción (A–D) tocables. */
  private buildQuestionView(): Modal {
    const quiz = this.level.quiz;
    const view = this.board.question;
    const { panel, question, card: cardStyle } = QUIZ_LAYOUT;
    const modal = this.buildModal(view.panelHeight);

    // Pregunta: tinta sepia (Special Elite) sobre la carta clara.
    modal.content.add(
      this.add
        .text(panel.centerX, view.questionCenterY, quiz.question, {
          fontFamily: question.fontFamily,
          fontSize: `${question.fontSize}px`,
          color: question.color,
          align: 'center',
          wordWrap: { width: panel.width - 2 * panel.padding, useAdvancedWrap: false },
        })
        .setOrigin(0.5),
    );

    // Tarjetas-opción: el índice va al reducer (nunca lógica inline aquí).
    quiz.options.forEach((option, index) => {
      const slot = view.cards[index];
      if (!slot) {
        return;
      }
      const card = new OptionCard(this, panel.centerX, slot.centerY, {
        index,
        text: option.text,
        width: cardStyle.width,
        height: slot.height,
        textWrapWidth:
          cardStyle.width - cardStyle.labelZoneWidth - 2 * cardStyle.textPaddingX,
        style: cardStyle,
        onPress: (): void => this.onSelect(index),
      });
      modal.content.add(card);
      this.cards.push(card);
    });
    return modal;
  }

  /** Vista feedback incorrecto (D5): placa de error + «Volver a empezar». */
  private buildFeedbackView(): Modal | null {
    const selected = this.state.selected;
    if (selected === null) {
      // Inalcanzable: feedback-wrong implica selected (garantía del reducer).
      return null;
    }
    const view = this.board.feedback;
    const { panel, plaque, feedback } = QUIZ_LAYOUT;
    const modal = this.buildModal(view.panelHeight);
    const innerWidth = panel.width - 2 * panel.padding;

    // Placa inset oscura: el error desaturado (palette.error) rinde ≥ 3:1
    // sobre el sepia oscuro (SPEC §7.1/§9) — sobre la carta clara no bastaba.
    modal.content.add(this.drawPlaque(panel.centerX - innerWidth / 2, view.plaqueTopY, innerWidth, view.plaqueHeight));

    // Rótulo con la opción elegida: «La opción C no es la correcta.»
    modal.content.add(
      this.add
        .text(panel.centerX, view.headerCenterY, wrongFeedbackHeader(selected), {
          fontFamily: feedback.headerFontFamily,
          fontSize: `${feedback.headerFontSize}px`,
          color: feedback.color,
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    );

    // Feedback pedagógico de ESA opción (2–6 líneas, del QuizConfig).
    const feedbackText = this.level.quiz.options[selected]?.feedback ?? '';
    modal.content.add(
      this.add
        .text(panel.centerX, view.feedbackTopY, feedbackText, {
          fontFamily: feedback.fontFamily,
          fontSize: `${feedback.fontSize}px`,
          color: feedback.color,
          fontStyle: 'bold',
          wordWrap: { width: innerWidth - 2 * plaque.paddingX, useAdvancedWrap: false },
        })
        .setOrigin(0.5, 0),
    );

    // «Volver a empezar el nivel»: reinicio del NIVEL completo (D5). El
    // botón vive dentro del contenido del modal: muere con él al trocar de
    // fase (sin huérfanos en la lista de display).
    modal.content.add(
      new GothicButton(this, panel.centerX, view.buttonCenterY, {
        label: QUIZ_LABELS.restartLevel,
        layout: QUIZ_ACTION_BUTTON,
        onPress: (): void => this.onContinueWrong(),
      }),
    );
    return modal;
  }

  /** Vista historia (SPEC §4.4): carta antigua con el fragmento + «Continuar». */
  private buildStoryView(): Modal {
    const view = this.board.story;
    const quiz = this.level.quiz;
    const { panel, plaque, story } = QUIZ_LAYOUT;
    const innerWidth = panel.width - 2 * panel.padding;
    const modal = this.buildModal(view.panelHeight);

    // Rótulo púrpura poción (acento de narrativa, SPEC §7.1).
    modal.content.add(
      this.add
        .text(panel.centerX, view.headingCenterY, story.heading, {
          fontFamily: story.headingFontFamily,
          fontSize: `${story.headingFontSize}px`,
          color: story.headingColor,
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    );

    // Placa con el feedback de la correcta («¡Correcto! …») en success
    // desaturado — sobre el sepia oscuro, contraste sobrado (SPEC §9).
    modal.content.add(this.drawPlaque(panel.centerX - innerWidth / 2, view.introPlaqueTopY, innerWidth, view.introPlaqueHeight));
    const introText = quiz.options[this.state.correctIndex]?.feedback ?? '';
    modal.content.add(
      this.add
        .text(panel.centerX, view.introTopY, introText, {
          fontFamily: story.fontFamily,
          fontSize: `${story.fontSize}px`,
          color: story.introColor,
          fontStyle: 'bold',
          wordWrap: { width: innerWidth - 2 * plaque.paddingX, useAdvancedWrap: false },
        })
        .setOrigin(0.5, 0),
    );

    // Cuerpo del fragmento: tinta sepia sobre la carta clara (estilo carta
    // antigua, SPEC §4.4/§7.1 — ~9:1 de contraste sobre parchmentLight).
    modal.content.add(
      this.add
        .text(panel.centerX, view.bodyTopY, quiz.storyFragment, {
          fontFamily: story.fontFamily,
          fontSize: `${story.fontSize}px`,
          color: story.bodyColor,
          wordWrap: { width: innerWidth, useAdvancedWrap: false },
          lineSpacing: Math.max(0, story.lineHeightPx - story.fontSize),
        })
        .setOrigin(0.5, 0),
    );

    // «Continuar» → VICTORY con {levelId} (el diploma es la Etapa 6). Como
    // el botón de reinicio, vive dentro del contenido del modal.
    modal.content.add(
      new GothicButton(this, panel.centerX, view.buttonCenterY, {
        label: QUIZ_LABELS.continueStory,
        layout: QUIZ_ACTION_BUTTON,
        onPress: (): void => this.onContinueStory(),
      }),
    );
    return modal;
  }

  /** Carta pergamino claro del tamaño de la vista (velo + marco + contenido). */
  private buildModal(panelHeight: number): Modal {
    const { panel, veil, depths } = QUIZ_LAYOUT;
    return new Modal(this, {
      centerX: panel.centerX,
      centerY: panel.centerY,
      width: panel.width,
      height: panelHeight,
      style: QUIZ_PANEL_STYLE,
      veil,
      depths: { veil: depths.veil, panel: depths.panel, content: depths.content },
    });
  }

  /** Placa inset oscura (fill + filete interior tenue) con datos de paleta. */
  private drawPlaque(
    x: number,
    y: number,
    width: number,
    height: number,
  ): Phaser.GameObjects.Graphics {
    const { fill, stroke, strokeAlpha, cornerRadius } = QUIZ_LAYOUT.plaque;
    const g = this.add.graphics();
    g.fillStyle(hexToNumber(fill), 1);
    g.fillRoundedRect(x, y, width, height, cornerRadius);
    g.lineStyle(2, hexToNumber(stroke), strokeAlpha);
    g.strokeRoundedRect(x + 4, y + 4, width - 8, height - 8, Math.max(2, cornerRadius - 4));
    return g;
  }

  // ---- Eventos (finos: el reducer decide, la escena aplica efectos) -----------

  /** Tap sobre la tarjeta-opción `index` (desde OptionCard, al soltar). */
  private onSelect(index: number): void {
    if (this.exiting) {
      return;
    }
    const next = quizReducer(this.state, { type: QuizEventType.Select, index });
    if (next === this.state) {
      return; // transición inválida: ignorada (idempotencia del reducer)
    }
    this.state = next;

    // Estado visual «deshabilitada tras responder» (PLAN Etapa 5): TODAS las
    // tarjetas se bloquean y dejan de aceptar taps — se VE antes del cambio
    // de vista, y el reducer ya ignora cualquier Select posterior.
    for (const card of this.cards) {
      card.setDisabled(true);
    }

    if (next.phase === QuizPhase.Story) {
      // Acierto: +100 (SPEC §5/§4.3) + arpegio mayor (SPEC §8). El HUD se
      // refresca solo por el evento `score:change` del ScoreSystem.
      this.systems.scoreSystem.add(QUIZ_POINTS, SCORE_CATEGORY.quiz);
      this.systems.audioSystem.arpeggio();
    } else {
      // Fallo: intervalo menor descendente suave (SPEC §8).
      this.systems.audioSystem.errorSound();
    }

    // Pausa breve para que la decisión se LEA (tarjeta bloqueada + sonido)
    // antes de que la carta muestre el feedback o el fragmento de historia.
    this.time.delayedCall(QUIZ_LAYOUT.fade.cardLockMs, () => {
      if (this.exiting) {
        return;
      }
      this.renderView(true);
    });
  }

  /** «Volver a empezar el nivel» (desde feedback-wrong): D5 completo. */
  private onContinueWrong(): void {
    const next = quizReducer(this.state, { type: QuizEventType.ContinueWrong });
    if (next === this.state) {
      return;
    }
    this.state = next;
    this.restartLevel();
  }

  /** «Continuar» (desde la carta de historia) → VICTORY. */
  private onContinueStory(): void {
    const next = quizReducer(this.state, { type: QuizEventType.ContinueStory });
    if (next === this.state) {
      return;
    }
    this.state = next;
    this.exitToVictory();
  }

  /**
   * Reinicio del NIVEL completo (D5): se DESCARTAN los puntos de la tanda
   * (`reset()` — tap + bonus + quiz de esa tanda, SPEC §5), el save MANTIENE
   * `inProgress = true` (re-marcar es idempotente, SPEC §11) y se vuelve a
   * NARRATIVE con {levelId} (avance rápido/skip disponible allí, SPEC §3).
   */
  private restartLevel(): void {
    if (this.exiting) {
      return;
    }
    this.exiting = true;
    this.systems.scoreSystem.reset();
    this.systems.saveSystem.setInProgress(true);
    transitionTo(this, SceneKey.NARRATIVE, { levelId: this.level.id });
  }

  /** Salida correcta del quiz: VICTORY con {levelId} (SPEC §3/§4.3). */
  private exitToVictory(): void {
    if (this.exiting) {
      return;
    }
    this.exiting = true;
    transitionTo(this, SceneKey.VICTORY, { levelId: this.level.id });
  }
}
