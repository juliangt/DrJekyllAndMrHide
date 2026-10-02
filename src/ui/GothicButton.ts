/**
 * GothicButton (SPEC §6/§7.2/§9, PLAN Etapa 2): botón reutilizable dentro
 * del canvas. `Phaser.GameObjects.Container` con:
 *
 *  - Marco pergamino oscuro de borde doble sepia redibujado por estado.
 *  - Estados hover (desktop) / pressed (táctil + mouse) / disabled, ruled
 *    por la MÁQUINA DE ESTADOS PURA de `./buttonState.ts` (testeable sin
 *    Phaser; este archivo solo la consume).
 *  - Hitbox EXPLÍCITA de `layout.height` px de alto (≥ 64, SPEC §9) —
 *    los containers no tienen tamaño intrínseco, hay que dársela.
 *  - Emite `onPress` al soltar (pointerup) sobre un botón que estaba
 *    pressed y habilitado; soltar fuera (pointerupoutside) cancela.
 */
import Phaser from 'phaser';
import { hexToNumber } from '../config/palette';
import {
  ButtonPointerEvent,
  ButtonVisualState,
  MENU_BUTTON_LAYOUT,
  nextButtonState,
  type ButtonLayout,
} from './buttonState';

/** Config de construcción (todo menos x/y, que van en el constructor). */
export interface GothicButtonConfig {
  /** Etiqueta visible (español, SPEC §6). */
  label: string;
  /** Se dispara al SOLTAR el puntero sobre el botón habilitado. */
  onPress: () => void;
  /** Layout alternativo (default: `MENU_BUTTON_LAYOUT`). */
  layout?: ButtonLayout;
  /** Ancho del botón (default: `layout.minWidth`). */
  width?: number;
  /** Nace deshabilitado (se puede cambiar con `setDisabled`). */
  disabled?: boolean;
}

export class GothicButton extends Phaser.GameObjects.Container {
  /** Ancho del marco y de la hitbox (px). */
  readonly buttonWidth: number;

  private readonly layout: ButtonLayout;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly config: GothicButtonConfig;
  private visualState: ButtonVisualState = ButtonVisualState.Idle;
  private disabled: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, config: GothicButtonConfig) {
    super(scene, x, y);
    this.config = config;
    this.layout = config.layout ?? MENU_BUTTON_LAYOUT;
    this.buttonWidth = config.width ?? this.layout.minWidth;
    this.disabled = config.disabled ?? false;

    const { height, fontSize, states } = this.layout;

    this.bg = scene.add.graphics();
    this.labelText = scene.add
      .text(0, 0, config.label, {
        fontFamily: this.layout.fontFamily,
        fontSize: `${fontSize}px`,
        color: states[ButtonVisualState.Idle].text,
      })
      .setOrigin(0.5);

    this.add([this.bg, this.labelText]);
    scene.add.existing(this);

    // Hitbox explícita: rectángulo centrado en el container (los containers
    // no derivan hit area de textura). Alto = layout.height ≥ 64 (SPEC §9).
    this.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(
        -this.buttonWidth / 2,
        -height / 2,
        this.buttonWidth,
        height,
      ),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    this.wireEvents();
    this.applyState();
  }

  /** Estado visual actual (para diagnóstico/tests de integración). */
  get visual(): ButtonVisualState {
    return this.visualState;
  }

  /** ¿Deshabilitado? (ignora input y se dibuja atenüado). */
  get isDisabled(): boolean {
    return this.disabled;
  }

  /** Habilita/deshabilita en caliente; redibuja y corta el input. */
  setDisabled(disabled: boolean): void {
    this.disabled = disabled;
    this.visualState = nextButtonState(this.visualState, ButtonPointerEvent.PointerOut, disabled);
    if (disabled) {
      this.disableInteractive();
    } else {
      this.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(
          -this.buttonWidth / 2,
          -this.layout.height / 2,
          this.buttonWidth,
          this.layout.height,
        ),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
    }
    this.applyState();
  }

  /** Redibuja el marco + texto según el estado (o el estado disabled). */
  private applyState(): void {
    const { height, cornerRadius, states } = this.layout;
    const w = this.buttonWidth;
    const left = -w / 2;
    const top = -height / 2;
    const colors = states[this.visualState];

    this.bg.clear();
    if (this.disabled) {
      // Disabled: mismos colores del idle pero con el container atenüado.
      this.bg.fillStyle(hexToNumber(states[ButtonVisualState.Idle].fill), 1);
      this.bg.fillRoundedRect(left, top, w, height, cornerRadius);
      this.bg.lineStyle(6, hexToNumber(states[ButtonVisualState.Idle].stroke), 1);
      this.bg.strokeRoundedRect(left, top, w, height, cornerRadius);
      this.bg.lineStyle(2, hexToNumber(states[ButtonVisualState.Idle].stroke), 0.6);
      this.bg.strokeRoundedRect(
        left + 9,
        top + 9,
        w - 18,
        height - 18,
        Math.max(2, cornerRadius - 6),
      );
      this.labelText.setColor(states[ButtonVisualState.Idle].text);
      this.setAlpha(0.45);
      this.setScale(1);
      return;
    }
    this.setAlpha(1);
    // Marco pergamino: relleno + borde doble (SPEC §7.2).
    this.bg.fillStyle(hexToNumber(colors.fill), 1);
    this.bg.fillRoundedRect(left, top, w, height, cornerRadius);
    this.bg.lineStyle(6, hexToNumber(colors.stroke), 1);
    this.bg.strokeRoundedRect(left, top, w, height, cornerRadius);
    this.bg.lineStyle(2, hexToNumber(colors.stroke), 0.6);
    this.bg.strokeRoundedRect(
      left + 9,
      top + 9,
      w - 18,
      height - 18,
      Math.max(2, cornerRadius - 6),
    );
    this.labelText.setColor(colors.text);
    // Feedback de presión: encoge levemente el botón entero.
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
    // Soltar fuera del botón tras un down dentro: cancelar SIN disparar.
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
