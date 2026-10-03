/**
 * TimerBar (SPEC §6/§4.2, PLAN Etapa 4): barra proporcional del tiempo
 * restante + segundos numéricos. En la ventana crítica (últimos 5 s) pasa a
 * rojo desaturado y PULSA (SPEC §7.2 «timer con pulso cuando quedan ≤ 5 s»).
 *
 * Capa Phaser fina: toda la aritmética (ratio, segundos, criticalidad) vive
 * en las funciones PURAS de `gameplay/timerTick.ts` (testeadas); aquí solo
 * se refleja el estado. Barato: dos rects y un texto; el pulso es UN tween
 * repetido que se arranca una sola vez al entrar en crítica.
 */
import Phaser from 'phaser';
import { hexToNumber, type HexColor } from '../config/palette';
import { isCriticalTime, secondsLeft, timerRatio } from '../gameplay/timerTick';

/** Opciones de construcción (layout desde `gameplay/actionLayout.ts`). */
export interface TimerBarOptions {
  /** Duración total de la tanda (ms) — para la proporción de la barra. */
  totalMs: number;
  width: number;
  height: number;
  depth: number;
  /** Colores: { fill, critical, track, text } (paleta §7.1). */
  colors: { fill: HexColor; critical: HexColor; track: HexColor; text: string };
  /** Tipografía de los segundos numéricos. */
  textStyle: { fontFamily: string; fontSize: number };
}

export class TimerBar {
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly secondsText: Phaser.GameObjects.Text;
  private readonly options: TimerBarOptions;
  private critical = false;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private lastLabel = '';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    secondsX: number,
    options: TimerBarOptions,
  ) {
    this.options = options;
    const { width, height, colors, depth, textStyle } = options;

    // Pista de fondo (el tiempo ya gastado se ve como hueco oscuro), también
    // anclada a la izquierda — misma referencia que el relleno.
    scene.add
      .rectangle(x, y, width, height, hexToNumber(colors.track))
      .setOrigin(0, 0.5)
      .setDepth(depth);

    // Relleno anclado a la IZQUIERDA (origin 0, 0.5): se encoge hacia atrás.
    this.fill = scene.add
      .rectangle(x, y, width, height, hexToNumber(colors.fill))
      .setOrigin(0, 0.5)
      .setDepth(depth);

    // Segundos numéricos a la derecha de la barra.
    this.secondsText = scene.add
      .text(secondsX, y, '', {
        fontFamily: textStyle.fontFamily,
        fontSize: `${textStyle.fontSize}px`,
        color: colors.text,
      })
      .setOrigin(0, 0.5)
      .setDepth(depth);
  }

  /** Refleja el tiempo restante (llamar por frame o al cambiar el timer). */
  setTimeLeft(timeLeftMs: number): void {
    const ratio = timerRatio(timeLeftMs, this.options.totalMs);
    // setSize (y no scaleX) mantiene el grosor en px exacto; con origin
    // (0, 0.5) la barra se encoge hacia su borde IZQUIERDO. El guard evita
    // regenerar geometría cuando el segundo mostrado no cambió (perf).
    const nextWidth = Math.max(1, this.options.width * ratio);
    if (this.fill.width !== nextWidth) {
      this.fill.setSize(nextWidth, this.options.height);
    }

    const label = String(secondsLeft(timeLeftMs));
    if (label !== this.lastLabel) {
      this.lastLabel = label;
      this.secondsText.setText(label);
    }

    const critical = isCriticalTime(timeLeftMs);
    if (critical !== this.critical) {
      this.critical = critical;
      this.fill.fillColor = hexToNumber(
        critical ? this.options.colors.critical : this.options.colors.fill,
      );
      if (critical) {
        this.startPulse();
      } else {
        this.stopPulse();
      }
    }
  }

  /** Pulso de la ventana crítica: alfa 1 ⇄ 0.55, sinusoidal, repetido. */
  private startPulse(): void {
    this.stopPulse();
    const scene = this.fill.scene;
    if (!scene) {
      return;
    }
    this.pulseTween = scene.tweens.add({
      targets: this.fill,
      alpha: { from: 1, to: 0.55 },
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private stopPulse(): void {
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    this.fill.scene?.tweens.killTweensOf(this.fill);
    this.fill.setAlpha(1);
  }
}
