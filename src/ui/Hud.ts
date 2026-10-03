/**
 * Hud (SPEC §6, PLAN Etapa 4): HUD superior de la fase de acción.
 *
 *  - Contador de meta: «Sustos causados: X/3» (`hudLabel` del ActionConfig).
 *  - Timer: `TimerBar` (barra proporcional + segundos; rojo/pulso ≤ 5 s).
 *  - Puntaje vivo: «Puntaje: N» actualizado por los eventos `score:change`
 *    del `ScoreSystem` (incluye el reset de la tanda — ese evento también
 *    refresca, así el «Reintentar» muestra 0 sin código extra).
 *  - Botón «Pausa»: GothicButton compacto (alto 72 ≥ 64 px táctil, SPEC §9)
 *    — la acción (volver a Menu guardando progreso) la inyecta la escena.
 *
 * Capa Phaser fina: posiciones/estilos/colores vienen de los DATOS de
 * `gameplay/actionLayout.ts` (testeados); el estado numérico lo empuja
 * `ActionScene` desde el reducer puro.
 */
import type Phaser from 'phaser';
import type { ScoreSystem } from '../systems/ScoreSystem';
import { ACTION_LAYOUT, ACTION_PAUSE_BUTTON } from '../gameplay/actionLayout';
import { GothicButton } from './GothicButton';
import { TimerBar } from './TimerBar';

/** Config de construcción (la escena pasa el nivel activo y las acciones). */
export interface HudConfig {
  /** Etiqueta del contador (N1: «Sustos causados», del ActionConfig). */
  hudLabel: string;
  /** Meta de taps (N1: 3). */
  goal: number;
  /** Tiempo límite de la tanda (ms). */
  timeLimitMs: number;
  /** Sistema de puntaje (HUD vivo por sus eventos). */
  scoreSystem: ScoreSystem;
  /** Al pulsar «Pausa» (la escena decide: volver a Menu guardando progreso). */
  onPause: () => void;
}

export class Hud {
  private readonly hudLabel: string;
  private readonly goal: number;
  private readonly counterText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly timerBar: TimerBar;
  private readonly unsubscribe: () => void;

  constructor(scene: Phaser.Scene, config: HudConfig) {
    const { hud, depths, hudTextStyle, timerColors } = ACTION_LAYOUT;
    this.hudLabel = config.hudLabel;
    this.goal = config.goal;

    const style = {
      fontFamily: hudTextStyle.fontFamily,
      fontSize: `${hudTextStyle.fontSize}px`,
      color: hudTextStyle.color,
    };

    // Sombra suave en los contadores: los separa de la niebla (SPEC §9).
    this.counterText = scene.add
      .text(hud.counter.x, hud.counter.y, this.counterLabel(0), style)
      .setOrigin(0, 0.5)
      .setDepth(depths.hud)
      .setShadow(0, 2, '#0d0f14', 6);

    this.scoreText = scene.add
      .text(hud.score.x, hud.score.y, this.scoreLabel(config.scoreSystem.getScore()), style)
      .setOrigin(0, 0.5)
      .setDepth(depths.hud)
      .setShadow(0, 2, '#0d0f14', 6);

    this.timerBar = new TimerBar(scene, hud.timerBar.x, hud.timerBar.y, hud.timerSeconds.x, {
      totalMs: config.timeLimitMs,
      width: hud.timerBar.width,
      height: hud.timerBar.height,
      depth: depths.hud,
      colors: timerColors,
      textStyle: { fontFamily: hudTextStyle.fontFamily, fontSize: hudTextStyle.fontSize },
    });

    new GothicButton(scene, hud.pause.x, hud.pause.y, {
      label: ACTION_PAUSE_BUTTON.label,
      layout: ACTION_PAUSE_BUTTON.layout,
      onPress: config.onPause,
    }).setDepth(depths.hud);

    // Puntaje vivo: cada cambio del ScoreSystem (incluido el reset de tanda)
    // refresca el texto sin que la escena empuje nada.
    this.unsubscribe = config.scoreSystem.onChange((payload) => {
      this.scoreText.setText(this.scoreLabel(payload.score));
    });
  }

  /** Etiqueta del contador: «Sustos causados: X/3» (SPEC §6). */
  private counterLabel(hits: number): string {
    return `${this.hudLabel}: ${hits}/${this.goal}`;
  }

  /** Refresca el contador de meta (lo empuja la escena tras cada hit). */
  setHits(hits: number): void {
    this.counterText.setText(this.counterLabel(hits));
  }

  /** Refresca el timer (lo empuja la escena cada frame). */
  setTimeLeft(timeLeftMs: number): void {
    this.timerBar.setTimeLeft(timeLeftMs);
  }

  private scoreLabel(score: number): string {
    return `Puntaje: ${score}`;
  }

  /** Retira la suscripción al ScoreSystem (al apagar la escena). */
  destroy(): void {
    this.unsubscribe();
  }
}
