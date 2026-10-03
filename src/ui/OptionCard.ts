/**
 * OptionCard (PLAN Etapa 5, SPEC §6/§9): tarjeta-opción del quiz (A–D).
 * Sigue el PATRÓN de GothicButton/buttonState (Etapa 2): la máquina de
 * estados visuales es la PURA `nextButtonState` (testeada), este archivo solo
 * la consume. Diferencias frente a GothicButton:
 *
 *  - Dos textos: la LETRA de opción (A–D, acento de fuego de farola) y el
 *    texto de la opción (Crimson Text, alineado a la izquierda, con wrap de
 *    Phaser al ancho que calculó `quizBoardLayout` — el alto de tarjeta ya
 *    reservó espacio de sobra porque esa estimación sobreestima).
 *  - Alto variable (el del layout puro), SIEMPRE ≥ 56 px (SPEC §9).
 *  - `setDisabled` tras responder: corta el input y atenúa (SPEC §6).
 *  - `onPress` al SOLTAR sobre una tarjeta pressed y habilitada; soltar
 *    fuera (pointerupoutside) cancela.
 */
import Phaser from 'phaser';
import { hexToNumber } from '../config/palette';
import {
  ButtonPointerEvent,
  ButtonVisualState,
  nextButtonState,
} from './buttonState';
import { optionLabel, type QuizOptionCardStyle } from '../gameplay/quizState';

/** Config de construcción (todo menos x/y, que van en el constructor). */
export interface OptionCardConfig {
  /** Índice de la opción (0-based → letra con `optionLabel`). */
  index: number;
  /** Texto de la opción (verbatim del QuizConfig). */
  text: string;
  /** Ancho de la tarjeta. */
  width: number;
  /** Alto de la tarjeta (del layout puro; ≥ 56 px, SPEC §9). */
  height: number;
  /** Ancho de wrap del texto (del layout puro, con margen conservador). */
  textWrapWidth: number;
  /** Datos de estilo (QUIZ_OPTION_CARD de gameplay/quizState). */
  style: QuizOptionCardStyle;
  /** Se dispara al SOLTAR el puntero sobre la tarjeta habilitada. */
  onPress: () => void;
}

export class OptionCard extends Phaser.GameObjects.Container {
  /** Ancho/alto del marco y de la hitbox (px) — para tests/diagnóstico. */
  readonly cardWidth: number;
  readonly cardHeight: number;

  private readonly style: QuizOptionCardStyle;
  private readonly config: OptionCardConfig;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly labelLetter: Phaser.GameObjects.Text;
  private readonly optionText: Phaser.GameObjects.Text;
  private visualState: ButtonVisualState = ButtonVisualState.Idle;
  private disabled = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: OptionCardConfig) {
    super(scene, x, y);
    this.config = config;
    this.style = config.style;
    this.cardWidth = config.width;
    this.cardHeight = config.height;

    const { states } = this.style;
    const w = config.width;
    const left = -w / 2;

    this.bg = scene.add.graphics();

    // Letra de opción (A–D) centrada en su celda izquierda.
    this.labelLetter = scene.add
      .text(left + this.style.labelZoneWidth / 2, 0, optionLabel(config.index), {
        fontFamily: this.style.labelFontFamily,
        fontSize: `${this.style.labelFontSize}px`,
        color: this.style.labelColor,
      })
      .setOrigin(0.5);

    // Texto de la opción: alineado a la izquierda de su zona, con el wrap
    // calculado por el layout puro (el alto reservado nunca se queda corto).
    this.optionText = scene.add
      .text(left + this.style.labelZoneWidth + this.style.textPaddingX, 0, config.text, {
        fontFamily: this.style.fontFamily,
        fontSize: `${this.style.textFontSize}px`,
        color: states[ButtonVisualState.Idle].text,
        wordWrap: { width: config.textWrapWidth, useAdvancedWrap: false },
        // Interlineado ≈ textLineHeightPx del layout (block real ≤ estimado).
        lineSpacing: Math.max(0, this.style.textLineHeightPx - this.style.textFontSize),
      })
      .setOrigin(0, 0.5);

    this.add([this.bg, this.labelLetter, this.optionText]);
    scene.add.existing(this);

    // Hitbox explícita del tamaño completo de la tarjeta (los containers no
    // derivan hit area de textura). Alto ≥ 56 px (SPEC §9).
    this.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-w / 2, -config.height / 2, w, config.height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    this.wireEvents();
    this.applyState();
  }

  /** ¿Deshabilitada? (tras responder: ignora input y se dibuja atenüada). */
  get isDisabled(): boolean {
    return this.disabled;
  }

  /** Estado visual actual (para diagnóstico/tests de integración). */
  get visual(): ButtonVisualState {
    return this.visualState;
  }

  /** Habilita/deshabilita en caliente; redibuja y corta el input. */
  setDisabled(disabled: boolean): void {
    this.disabled = disabled;
    this.visualState = nextButtonState(this.visualState, ButtonPointerEvent.PointerOut, disabled);
    if (disabled) {
      this.disableInteractive();
    } else {
      const w = this.cardWidth;
      this.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(
          -w / 2,
          -this.cardHeight / 2,
          w,
          this.cardHeight,
        ),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
    }
    this.applyState();
  }

  /** Redibuja el marco + textos según el estado (o el disabled atenüado). */
  private applyState(): void {
    const { cornerRadius, states, disabledAlpha } = this.style;
    const w = this.cardWidth;
    const h = this.cardHeight;
    const left = -w / 2;
    const top = -h / 2;
    const colors = states[this.disabled ? ButtonVisualState.Idle : this.visualState];

    this.bg.clear();
    // Marco pergamino oscuro con filete interior (patrón GothicButton).
    this.bg.fillStyle(hexToNumber(colors.fill), 1);
    this.bg.fillRoundedRect(left, top, w, h, cornerRadius);
    this.bg.lineStyle(4, hexToNumber(colors.stroke), 1);
    this.bg.strokeRoundedRect(left, top, w, h, cornerRadius);
    this.bg.lineStyle(2, hexToNumber(colors.stroke), 0.6);
    this.bg.strokeRoundedRect(left + 7, top + 7, w - 14, h - 14, Math.max(2, cornerRadius - 5));
    // Regla tenue que separa la celda de la letra del texto.
    const ruleX = left + this.style.labelZoneWidth;
    this.bg.lineStyle(2, hexToNumber(colors.stroke), 0.35);
    this.bg.beginPath();
    this.bg.moveTo(ruleX, top + 10);
    this.bg.lineTo(ruleX, top + h - 10);
    this.bg.strokePath();

    this.labelLetter.setColor(this.style.labelColor);
    this.optionText.setColor(colors.text);

    if (this.disabled) {
      // Deshabilitada tras responder: idle + atenüada (SPEC §6).
      this.setAlpha(disabledAlpha);
      this.setScale(1);
      return;
    }
    this.setAlpha(1);
    // Feedback de presión: encoge levemente la tarjeta entera.
    this.setScale(this.visualState === ButtonVisualState.Pressed ? 0.97 : 1);
  }

  /** Conecta los eventos de puntero de Phaser con la máquina de estados. */
  private wireEvents(): void {
    this.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.transition(ButtonPointerEvent.PointerOver);
    });
    this.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.transition(ButtonPointerEvent.PointerOut);
    });
    this.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.transition(ButtonPointerEvent.PointerDown);
    });
    this.on(Phaser.Input.Events.POINTER_UP, () => {
      const wasPressed = this.visualState === ButtonVisualState.Pressed;
      this.transition(ButtonPointerEvent.PointerUp);
      if (wasPressed && !this.disabled) {
        this.config.onPress();
      }
    });
    // Soltar fuera de la tarjeta tras un down dentro: cancelar SIN disparar.
    this.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => {
      this.transition(ButtonPointerEvent.PointerUpOutside);
    });
  }

  /** Aplica un evento de puntero a través de la máquina pura y redibuja. */
  private transition(event: ButtonPointerEvent): void {
    this.visualState = nextButtonState(this.visualState, event, this.disabled);
    this.applyState();
  }
}
