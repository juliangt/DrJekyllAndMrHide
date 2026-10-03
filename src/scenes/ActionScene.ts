/**
 * ACTION (SPEC §3, §4.2 / PLAN Etapa 4 — etapa crítica): escena GENÉRICA
 * que ejecuta el `ActionConfig` del nivel activo (v1: `tap-target`).
 *
 * ARQUITECTURA (el corazón de la etapa): esta escena es una CAPA FINA que
 * consume módulos PUROS testeables — TODO el estado la decide el reducer
 * `actionReducer` (gameplay/actionState), el movimiento de la niña es
 * `stepErratic` (gameplay/erraticMovement), el hit-test es `isHit`
 * (gameplay/hitbox), el bonus `timeBonus` (gameplay/scoring), el tick del
 * timer `shouldTick` (gameplay/timerTick), y el layout/textos/overlay son
 * DATOS (gameplay/actionLayout, gameplay/gameOverOverlay, art/parallax).
 *
 *  - Nivel activo por scene-start data `{ levelId }` (desde NARRATIVE).
 *  - Al entrar: `scoreSystem.reset()` — tanda nueva (inProgress ya está en
 *    true desde Menu, SPEC §11).
 *  - Fondo: callejón parallax (ParallaxField + ACTION_PARALLAX_LAYERS) con
 *    suelo, farolas en flicker y 3 bandas de niebla en deriva; pool de
 *    puffs acotado (SPEC §10.4), cero generación de texturas por frame.
 *  - Input: `pointerdown` a NIVEL DE ESCENA procesando TODOS los pointers
 *    activos — `input.addPointer(2)` (3 en total). Phaser emite UN evento
 *    POINTER_DOWN POR pointer (verificado en src/input/InputPlugin.js:
 *    `update(type, pointers)` itera los punteros y llama
 *    `processDownEvents(pointer)` para cada uno), así que 60 taps rápidos
 *    con varios dedos no pierden hits. Los taps sobre UI (pausa) se
 *    detectan por el array `currentlyOver` y no cuentan como juego.
 *  - Meta 3/3: la niña huye (tween) + bonus 2 pts/s → fade a QUIZ.
 *  - Timeout: overlay GAME_OVER (datos de gameplay/gameOverOverlay) +
 *    «Reintentar» → `Restart` del reducer + `scoreSystem.reset()` (tanda a
 *    0). NO es GameOver de partida.
 *  - Pausa: vuelve a Menu guardando progreso (SPEC §6).
 *  - `?debug`: contador de FPS (para el CA de perf de la Etapa 7); costo
 *    cero cuando está apagado.
 */
import Phaser from 'phaser';
import { SceneKey } from '../config/sceneKeys';
import { activeLevelFor } from '../config/narrative';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { hexToNumber, hexToRgb, nightBackground, street, textPrimary } from '../config/palette';
import { TEXTURE_KEYS } from '../art/textures';
import { ACTION_PARALLAX_LAYERS } from '../art/parallax';
import { ParallaxField } from '../art/ParallaxField';
import { getSystems } from '../systems/getSystems';
import { SCORE_CATEGORY } from '../systems/ScoreSystem';
import type { AudioSystem } from '../systems/AudioSystem';
import type { SaveSystem } from '../systems/SaveSystem';
import type { ScoreSystem } from '../systems/ScoreSystem';
import type { LevelConfig, TapTargetActionConfig } from '../config/levels/types';
import { fadeIn, transitionTo } from './sceneNav';
import { Hud } from '../ui/Hud';
import { GothicButton } from '../ui/GothicButton';
import {
  ACTION_DT_CAP_MS,
  ACTION_FEEDBACK,
  ACTION_FLOAT_STYLE,
  ACTION_LAYOUT,
  FPS_DEBUG_STYLE,
  GIRL_WALK_BOB,
  PUFF_POOL_SIZE,
} from '../gameplay/actionLayout';
import {
  ActionEventType,
  ActionPhase,
  actionReducer,
  initialActionState,
  type ActionState,
} from '../gameplay/actionState';
import {
  initialErraticState,
  stepErratic,
  type ErraticOptions,
  type ErraticState,
} from '../gameplay/erraticMovement';
import { isHit } from '../gameplay/hitbox';
import { TAP_POINTS, timeBonus } from '../gameplay/scoring';
import { shouldTick, tickSecond } from '../gameplay/timerTick';
import { GAME_OVER_OVERLAY, GAME_OVER_STYLE } from '../gameplay/gameOverOverlay';
import { debugEnabled } from '../config/debug';

/** Datos de arranque (`scene.start(ACTION, data)`), desde NARRATIVE. */
export interface ActionSceneData {
  levelId?: number;
}

/** Estilo plano para los textos flotantes (datos → estilo Phaser). */
interface FloatStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
}

export class ActionScene extends Phaser.Scene {
  private level!: LevelConfig;
  private action!: TapTargetActionConfig;
  private state!: ActionState;
  private erratic!: ErraticState;
  private erraticOptions!: ErraticOptions;

  private systems!: { saveSystem: SaveSystem; audioSystem: AudioSystem; scoreSystem: ScoreSystem };
  private field!: ParallaxField;
  private girl!: Phaser.GameObjects.Image;
  /** La niña está en su mini-estallido de susto (invisible, intocable). */
  private girlHidden = false;
  private hud!: Hud;
  private overlay!: Phaser.GameObjects.Container;
  private readonly puffs: Phaser.GameObjects.Image[] = [];
  private scareEvent: Phaser.Time.TimerEvent | null = null;
  private lastTickedSecond: number | null = null;
  private gameOverShown = false;
  private exiting = false;
  private bobPhase = 0;
  private fpsText: Phaser.GameObjects.Text | null = null;
  private fpsUpdatedAt = 0;

  constructor() {
    super(SceneKey.ACTION);
  }

  init(data: ActionSceneData = {}): void {
    this.level = activeLevelFor(data.levelId);
    this.action = this.level.action; // v1: la unión solo tiene 'tap-target'
    this.state = initialActionState({
      goal: this.action.goal,
      timeLimitSec: this.action.timeLimitSec,
    });
    this.erraticOptions = {
      speedRange: this.action.target.speedRange,
      dirChangeMs: this.action.target.dirChangeMs,
      bounds: ACTION_LAYOUT.playZone,
    };
    this.erratic = initialErraticState(Math.random, this.erraticOptions);
    this.exiting = false;
    this.gameOverShown = false;
    this.girlHidden = false;
    this.lastTickedSecond = null;
    this.scareEvent = null;
    this.puffs.length = 0;
  }

  create(): void {
    this.systems = getSystems(this);
    // Tanda nueva al entrar a ACTION (puntaje de la tanda anterior fuera).
    this.systems.scoreSystem.reset();

    // Multi-touch: 2 pointers EXTRA (3 en total). Cada pointer activo emite
    // su propio POINTER_DOWN a nivel de escena — ver cabecera del módulo.
    // El guard evita acumular pointers si la escena se recrea (máx. 10).
    if (!this.input.pointer2) {
      this.input.addPointer(2);
    }

    fadeIn(this);
    this.cameras.main.setBackgroundColor(nightBackground);

    // Fondo: callejón del minijuego (tabla ACTION_PARALLAX_LAYERS + suelo).
    this.field = new ParallaxField(this, {
      layers: ACTION_PARALLAX_LAYERS,
      ground: { color: street, y: ACTION_LAYOUT.groundY },
    });

    this.buildGirl();
    this.buildPuffPool();
    this.buildGameOverOverlay();
    this.buildDebugFps();

    this.hud = new Hud(this, {
      hudLabel: this.action.hudLabel,
      goal: this.action.goal,
      timeLimitMs: this.state.timeLimitMs,
      scoreSystem: this.systems.scoreSystem,
      onPause: (): void => this.onPause(),
    });
    this.hud.setHits(this.state.hits);
    this.hud.setTimeLeft(this.state.timeLeftMs);

    // Tap a nivel de escena: TODOS los pointers activos (multi-touch real).
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        this.onPointerDown(pointer, currentlyOver);
      },
    );

    // La suscripción del HUD al ScoreSystem muere con la escena.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hud.destroy());
  }

  update(time: number, delta: number): void {
    const t = time / 1000;
    this.field.update(t);

    // Timer + fases: el reducer decide TODO (dt acotado: un stall del
    // navegador no devora 5 s de golpe).
    const dtMs = Math.min(delta, ACTION_DT_CAP_MS);
    this.state = actionReducer(this.state, { type: ActionEventType.Tick, dtMs });
    if (this.state.phase === ActionPhase.Timeout) {
      this.onTimeout();
    }

    if (this.state.phase === ActionPhase.Playing) {
      // Tick sonoro: últimos 5 s, un tick por SEGUNDO mostrado (sin dobles).
      if (shouldTick(this.state.timeLeftMs, this.lastTickedSecond)) {
        this.lastTickedSecond = tickSecond(this.state.timeLeftMs);
        this.systems.audioSystem.tick();
      }
      // Movimiento errático (rng de runtime; la función pura es determinista
      // con el rng inyectado — los tests inyectan secuencias).
      this.erratic = stepErratic(this.erratic, dtMs, Math.random, this.erraticOptions);
    }

    this.hud.setTimeLeft(this.state.timeLeftMs);
    this.renderGirl(t);
    this.updateDebugFps(time);
  }

  // ---- Construcción ---------------------------------------------------------

  private buildGirl(): void {
    this.girl = this.add
      .image(this.erratic.x, this.erratic.y, this.action.target.texture)
      .setDisplaySize(ACTION_LAYOUT.girl.width, ACTION_LAYOUT.girl.height)
      .setDepth(ACTION_LAYOUT.depths.girl);
    this.bobPhase = Math.random() * Math.PI * 2;
  }

  /** Pool fijo de puffs de niebla (SPEC §10.4: nada de crear/romper por tap). */
  private buildPuffPool(): void {
    for (let i = 0; i < PUFF_POOL_SIZE; i++) {
      this.puffs.push(
        this.add
          .image(0, 0, TEXTURE_KEYS.fogPuff)
          .setDepth(ACTION_LAYOUT.depths.effects)
          .setVisible(false),
      );
    }
  }

  /** Overlay GAME_OVER del timeout (datos de gameplay/gameOverOverlay). */
  private buildGameOverOverlay(): void {
    const { depths } = ACTION_LAYOUT;
    const overlay = this.add.container(0, 0).setDepth(depths.overlay).setVisible(false);
    this.overlay = overlay;

    // Velo de niebla interactivo: oscurece y se come los taps del juego.
    const veil = this.add
      .rectangle(
        BASE_WIDTH / 2,
        BASE_HEIGHT / 2,
        BASE_WIDTH,
        BASE_HEIGHT,
        hexToNumber(GAME_OVER_OVERLAY.veil.color),
        GAME_OVER_OVERLAY.veil.alpha,
      )
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-BASE_WIDTH / 2, -BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      });
    overlay.add(veil);

    // Panel pergamino + textos del SPEC §6 (tono amable, sin rojo agresivo).
    overlay.add(
      this.add
        .image(BASE_WIDTH / 2, BASE_HEIGHT / 2, GAME_OVER_OVERLAY.panel.textureKey)
        .setDisplaySize(GAME_OVER_OVERLAY.panel.width, GAME_OVER_OVERLAY.panel.height),
    );
    overlay.add(
      this.add
        .text(BASE_WIDTH / 2, BASE_HEIGHT / 2 - 105, GAME_OVER_OVERLAY.title, {
          fontFamily: GAME_OVER_STYLE.title.fontFamily,
          fontSize: `${GAME_OVER_STYLE.title.fontSize}px`,
          color: GAME_OVER_STYLE.title.color,
          align: 'center',
          wordWrap: { width: GAME_OVER_STYLE.title.wordWrapWidth },
        })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(BASE_WIDTH / 2, BASE_HEIGHT / 2 + 45, GAME_OVER_OVERLAY.subtitle, {
          fontFamily: GAME_OVER_STYLE.subtitle.fontFamily,
          fontSize: `${GAME_OVER_STYLE.subtitle.fontSize}px`,
          color: GAME_OVER_STYLE.subtitle.color,
        })
        .setOrigin(0.5),
    );

    const retryButton = new GothicButton(this, BASE_WIDTH / 2, BASE_HEIGHT / 2 + 145, {
      label: GAME_OVER_OVERLAY.retryLabel,
      onPress: (): void => this.onRetry(),
    });
    retryButton.setDepth(depths.overlay + 1);
    overlay.add(retryButton);
  }

  /** Contador de FPS para `?debug` (Etapa 7: medición en device real). */
  private buildDebugFps(): void {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (!debugEnabled(search)) {
      return; // sin ?debug: ni el objeto de texto existe (costo cero)
    }
    this.fpsText = this.add
      .text(16, BASE_HEIGHT - 16, '… FPS', {
        fontFamily: FPS_DEBUG_STYLE.fontFamily,
        fontSize: `${FPS_DEBUG_STYLE.fontSize}px`,
        color: FPS_DEBUG_STYLE.color,
      })
      .setOrigin(0, 1)
      .setDepth(ACTION_LAYOUT.depths.hud);
  }

  // ---- Input ------------------------------------------------------------------

  /**
   * Un pointerdown: hit-test geométrico puro contra la hitbox +20 % de la
   * niña (posición LÓGICA errática — el bob visual es ±4 px, holgadamente
   * dentro de la expansión). Al aire: puff de niebla, sin castigo (SPEC §4.2).
   */
  private onPointerDown(
    pointer: Phaser.Input.Pointer,
    currentlyOver: Phaser.GameObjects.GameObject[],
  ): void {
    if (this.exiting || this.state.phase !== ActionPhase.Playing || this.girlHidden) {
      return;
    }
    // El tap cayó sobre UI interactiva (botón pausa / overlay): es suyo.
    if (currentlyOver.length > 0) {
      return;
    }

    const point = { x: pointer.worldX, y: pointer.worldY };
    const target = {
      x: this.erratic.x,
      y: this.erratic.y,
      width: ACTION_LAYOUT.girl.width,
      height: ACTION_LAYOUT.girl.height,
    };

    if (isHit(point, target)) {
      this.onHit();
    } else {
      this.onMiss(point);
    }
  }

  /** Tap exitoso: la niña se asusta pero sale ilesa (reencuadre D4). */
  private onHit(): void {
    const next = actionReducer(this.state, { type: ActionEventType.Hit });
    this.state = next;
    this.systems.scoreSystem.add(TAP_POINTS, SCORE_CATEGORY.taps); // +10 (SPEC §5)
    this.hud.setHits(next.hits);

    // Feedback (SPEC §4.2/§7.2): flash blanco + micro-shake + «!» + «+10»
    // + sonido compuesto (thump grave + click agudo, SPEC §8). El flash usa
    // el blanco cálido del texto de la paleta (#e8e3d5), no un blanco puro.
    const { r, g, b } = hexToRgb(textPrimary);
    this.cameras.main.flash(ACTION_FEEDBACK.flashMs, r, g, b);
    this.cameras.main.shake(ACTION_FEEDBACK.shakeMs, ACTION_FEEDBACK.shakeIntensity);
    this.systems.audioSystem.thump();
    this.systems.audioSystem.blip(0.07, 1150, 780);
    this.floatText('!', this.girl.x, this.girl.y - ACTION_LAYOUT.girl.height / 2 - 12, ACTION_FLOAT_STYLE.exclamation, -46);
    this.floatText('+10', this.girl.x + 74, this.girl.y - 30, ACTION_FLOAT_STYLE.points, -36);

    if (next.phase === ActionPhase.Goal) {
      this.onGoal();
      return;
    }
    // «Sale corriendo asustada pero ilesa»: mini-estallido + reaparición.
    this.scareGirl();
  }

  /** Tap al aire: puff de niebla + sonido suave, SIN castigo (SPEC §4.2). */
  private onMiss(point: { x: number; y: number }): void {
    this.spawnPuff(point.x, point.y, 0);
    this.systems.audioSystem.noise(0.12);
  }

  // ---- Finales de tanda --------------------------------------------------------

  /** Meta 3/3: bonus de tiempo + la niña huye → fade a QUIZ (SPEC §5). */
  private onGoal(): void {
    // Bonus por tiempo restante: 2 pts/s con floor (se suma UNA vez).
    const bonus = timeBonus(this.state.timeLeftMs);
    if (bonus > 0) {
      this.systems.scoreSystem.add(bonus, SCORE_CATEGORY.timeBonus);
      this.floatText(`+${bonus}`, BASE_WIDTH / 2, BASE_HEIGHT / 2 - 60, ACTION_FLOAT_STYLE.points, -44);
    }

    // La niña huye de la pantalla asustada (pero ilesa) por donde iba.
    const fleeX = this.erratic.vx >= 0 ? BASE_WIDTH + 180 : -180;
    this.tweens.add({
      targets: this.girl,
      x: fleeX,
      duration: ACTION_FEEDBACK.fleeMs,
      ease: 'Sine.easeIn',
    });
    this.systems.audioSystem.noise(0.22); // pasos que se pierden en la niebla

    this.time.delayedCall(ACTION_FEEDBACK.exitDelayMs, () => {
      if (this.exiting) {
        return;
      }
      this.exiting = true;
      transitionTo(this, SceneKey.QUIZ, { levelId: this.level.id });
    });
  }

  /** Timeout: overlay GAME_OVER (NO GameOver de partida) + tono grave. */
  private onTimeout(): void {
    if (this.gameOverShown) {
      return; // se muestra una sola vez
    }
    this.gameOverShown = true;
    this.cancelScare();
    this.girlHidden = false;
    this.systems.audioSystem.timeout(); // tono grave sostenido con decay

    // El overlay entra con un fade suave (sin golpe, tono amable).
    this.overlay.setAlpha(0);
    this.overlay.setVisible(true);
    this.tweens.add({
      targets: this.overlay,
      alpha: { from: 0, to: 1 },
      duration: GAME_OVER_OVERLAY.fadeMs,
      ease: 'Sine.easeOut',
    });
  }

  /** «Reintentar»: reinicia SOLO el minijuego, tanda a 0 (D6/SPEC §5). */
  private onRetry(): void {
    this.systems.scoreSystem.reset(); // puntaje de la tanda a 0
    this.state = actionReducer(this.state, { type: ActionEventType.Restart });
    this.lastTickedSecond = null;
    this.gameOverShown = false;
    this.overlay.setVisible(false);

    // La niña vuelve al centro de la zona con dirección nueva.
    this.cancelScare();
    this.girlHidden = false;
    this.girl.setVisible(true);
    this.erratic = initialErraticState(Math.random, this.erraticOptions);

    this.hud.setHits(this.state.hits);
    this.hud.setTimeLeft(this.state.timeLeftMs);
  }

  /** Pausa: vuelve a Menu guardando progreso de nivel (SPEC §6). */
  private onPause(): void {
    if (this.exiting) {
      return;
    }
    this.exiting = true;
    // inProgress ya viene en true desde Menu (SPEC §11 «se guarda al
    // comenzar nivel»); re-marcarlo es idempotente y asegura el «Continuar».
    this.systems.saveSystem.setInProgress(true);
    transitionTo(this, SceneKey.MENU);
  }

  // ---- Feedback visual (barato: tweens sobre pocos objetos) --------------------

  /** La niña «sale corriendo asustada pero ilesa» y reaparece (D4). */
  private scareGirl(): void {
    this.cancelScare();
    this.girlHidden = true;
    this.girl.setVisible(false);
    // Mini-estallido de niebla en su posición.
    this.spawnPuff(this.erratic.x - 26, this.erratic.y - 8, 0);
    this.spawnPuff(this.erratic.x + 30, this.erratic.y + 12, 60);
    this.spawnPuff(this.erratic.x, this.erratic.y - 34, 120);

    this.scareEvent = this.time.delayedCall(ACTION_FEEDBACK.scareMs, () => {
      this.scareEvent = null;
      if (this.exiting || this.state.phase !== ActionPhase.Playing) {
        return;
      }
      // Reaparece en otra esquina del callejón, lista para el próximo susto.
      this.erratic = initialErraticState(Math.random, this.erraticOptions);
      this.girlHidden = false;
      this.girl.setVisible(true);
    });
  }

  private cancelScare(): void {
    if (this.scareEvent) {
      this.scareEvent.remove(false);
      this.scareEvent = null;
    }
    this.girlHidden = false;
  }

  /** Un puff del pool: crece y se disipa. Si el pool está agotado, se ignora. */
  private spawnPuff(x: number, y: number, delayMs: number): void {
    const puff = this.puffs.find((candidate) => !candidate.visible);
    if (!puff) {
      return; // pool acotado (SPEC §10.4): mejor perder un puff que allocar
    }
    this.tweens.killTweensOf(puff);
    puff
      .setPosition(x, y)
      .setVisible(true)
      .setAlpha(0.85)
      .setScale(0.55);
    this.tweens.add({
      targets: puff,
      scale: 1.2,
      alpha: 0,
      duration: ACTION_FEEDBACK.puffMs,
      delay: delayMs,
      ease: 'Sine.easeOut',
      onComplete: () => puff.setVisible(false),
    });
  }

  /** Texto flotante («!», «+10», bonus): sube, se desvanece y se destruye. */
  private floatText(label: string, x: number, y: number, style: FloatStyle, risePx: number): void {
    const text = this.add
      .text(x, y, label, {
        fontFamily: style.fontFamily,
        fontSize: `${style.fontSize}px`,
        color: style.color,
      })
      .setOrigin(0.5)
      .setDepth(ACTION_LAYOUT.depths.feedback)
      .setShadow(0, 3, '#0d0f14', 8);
    this.tweens.add({
      targets: text,
      y: y + risePx,
      alpha: { from: 1, to: 0 },
      duration: ACTION_FEEDBACK.floatMs,
      ease: 'Sine.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  /** Refleja el estado errático + la animación de caminar (bob/tilt baratos). */
  private renderGirl(tSec: number): void {
    if (this.state.phase !== ActionPhase.Playing || this.girlHidden) {
      return; // en goal huye por tween; en timeout queda congelada
    }
    const bob = Math.sin(tSec * GIRL_WALK_BOB.speed + this.bobPhase) * GIRL_WALK_BOB.amplitudePx;
    const tilt = Math.sin(tSec * GIRL_WALK_BOB.tiltSpeed + this.bobPhase) * GIRL_WALK_BOB.tiltRad;
    this.girl.setPosition(this.erratic.x, this.erratic.y + bob);
    this.girl.setRotation(tilt);
  }

  private updateDebugFps(time: number): void {
    if (!this.fpsText || time - this.fpsUpdatedAt < 500) {
      return; // 2 lecturas por segundo es suficiente (EMA del loop)
    }
    this.fpsUpdatedAt = time;
    this.fpsText.setText(`${Math.round(this.game.loop.actualFps)} FPS`);
  }
}
