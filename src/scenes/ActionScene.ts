/**
 * ACTION (SPEC §3, §4.2 / PLAN Etapa 4 + Fase 3 del multi-nivel): escena
 * GENÉRICA que ejecuta el `ActionConfig` del nivel activo — las TRES
 * mecánicas de la unión:
 *
 *  - N1 'tap-target' (`actionReducer`): sustos a la niña errática.
 *  - N2 'cane-strike' (`caneReducer`): bastonazos de mango blanco al Dr.
 *    Lanyon, que HUYE (`stepFlee`) y cae al suelo en el golpe de meta,
 *    seguido de la línea de victoria de Hyde en pergamino.
 *  - N3 'transform-target' (`transformReducer`): asedio al laboratorio con
 *    intro cinemática de la puerta (skipeable), Hyde que alterna con
 *    Jekyll (ventana invulnerable de `revertMs`) y la entrada final de
 *    Poole y Utterson.
 *
 * ARQUITECTURA (el corazón de la etapa): esta escena es una CAPA FINA que
 * consume módulos PUROS testeables — TODO el estado lo deciden los reducers
 * (gameplay/actionState · caneState · transformState, despachados por
 * `mechanic` con el glue de gameplay/round), el movimiento es `stepErratic`/
 * `stepFlee` (gameplay/erraticMovement), el hit-test `isHit`
 * (gameplay/hitbox), el bonus `timeBonus` (gameplay/scoring), el tick del
 * timer `shouldTick` (gameplay/timerTick), y el layout/textos/secuencias/
 * overlay son DATOS (gameplay/actionLayout · actionSequences ·
 * gameOverOverlay, art/parallax). La escena NO decide reglas: solo anima
 * (tweens baratos sobre pocos objetos, pools acotados, cero generación de
 * texturas por frame, SPEC §10.4) y refleja el estado del reducer.
 *
 *  - Input: `pointerdown` a NIVEL DE ESCENA procesando TODOS los pointers
 *    activos — `input.addPointer(2)` (3 en total). Los taps sobre UI
 *    (pausa/overlay) se detectan por `currentlyOver` y no cuentan.
 *  - Meta: bonus 2 pts/s → fade a QUIZ (idéntico para las tres mecánicas).
 *  - Timeout: overlay GAME_OVER (datos de gameplay/gameOverOverlay) +
 *    «Reintentar» → `Restart` del reducer + `scoreSystem.reset()`.
 *  - Pausa: vuelve a Menu guardando progreso (SPEC §6).
 *  - `?debug`: contador de FPS; costo cero cuando está apagado.
 */
import Phaser from 'phaser';
import { SceneKey } from '../config/sceneKeys';
import { activeLevelFor } from '../config/narrative';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import {
  hexToNumber,
  hexToRgb,
  labGreen,
  nightBackground,
  parchmentLight,
  potionPurple,
  textPrimary,
} from '../config/palette';
import { TEXTURE_KEYS } from '../art/textures';
import { ParallaxField } from '../art/ParallaxField';
import { getSystems } from '../systems/getSystems';
import { SCORE_CATEGORY } from '../systems/ScoreSystem';
import type { AudioSystem } from '../systems/AudioSystem';
import type { SaveSystem } from '../systems/SaveSystem';
import type { ScoreSystem } from '../systems/ScoreSystem';
import type {
  ActionConfig,
  LevelConfig,
  TransformTargetActionConfig,
} from '../config/levels/types';
import { fadeIn, transitionTo } from './sceneNav';
import { Hud } from '../ui/Hud';
import { GothicButton } from '../ui/GothicButton';
import {
  ACTION_BACKGROUNDS,
  ACTION_DT_CAP_MS,
  ACTION_FEEDBACK,
  ACTION_FLOAT_STYLE,
  ACTION_LAB_PROPS,
  ACTION_LAYOUT,
  ACTION_TARGET_SIZES,
  FPS_DEBUG_STYLE,
  GIRL_WALK_BOB,
  PUFF_POOL_SIZE,
} from '../gameplay/actionLayout';
import {
  CANE_SWING,
  FALL_SEQUENCE,
  JEKYLL_MISS_NOTICE,
  JEKYLL_SPEED_FACTOR,
  NEAR_MISS_HOP,
  SIEGE_ENTRANCE,
  SIEGE_INTRO,
  STAR_TWINKLE,
  TRANSFORM_ANIM,
  VICTORY_LINE,
} from '../gameplay/actionSequences';
import {
  ActionPhase,
  actionReducer,
  initialActionState,
} from '../gameplay/actionState';
import {
  CanePhase,
  caneReducer,
  initialCaneState,
} from '../gameplay/caneState';
import {
  TargetForm,
  TransformPhase,
  initialTransformState,
  transformReducer,
  type TransformState,
} from '../gameplay/transformState';
import {
  RoundEventType,
  adaptRoundReducer,
  type RoundEvent,
  type AnyRoundState,
} from '../gameplay/round';
import {
  initialErraticState,
  stepErratic,
  stepFlee,
  type ErraticOptions,
  type ErraticState,
  type ThreatPoint,
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

/** Una estrella titilante del cielo del N2 (pool de 5, alpha por frame). */
interface TwinklingStar {
  sprite: Phaser.GameObjects.Image;
  phase: number;
}

export class ActionScene extends Phaser.Scene {
  private level!: LevelConfig;
  private action!: ActionConfig;
  private mechanic!: ActionConfig['mechanic'];

  // ---- Tanda: el estado lo deciden los reducers (capa fina, sin reglas) ----
  private state!: AnyRoundState;
  /** Despachador unificado (glue de gameplay/round) fijado en init(). */
  private dispatchRound!: (event: RoundEvent) => void;

  // ---- Movimiento del objetivo (errático; + huida N2, + tregua N3) ----------
  private erratic!: ErraticState;
  private erraticOptions!: ErraticOptions;
  /** N3: los mismos bounds con la velocidad de Jekyll (tregua de ventana). */
  private jekyllOptions: ErraticOptions | null = null;
  /** N2: punto del último tap — Lanyon huye de aquí (stepFlee). */
  private threat: ThreatPoint | null = null;

  // ---- Sistemas, fondo, HUD y pools compartidos -----------------------------
  private systems!: { saveSystem: SaveSystem; audioSystem: AudioSystem; scoreSystem: ScoreSystem };
  private field!: ParallaxField;
  private hud!: Hud;
  private overlay!: Phaser.GameObjects.Container;
  private readonly puffs: Phaser.GameObjects.Image[] = [];

  // ---- Objetivo (niña / Lanyon / Hyde↔Jekyll) -------------------------------
  private target!: Phaser.GameObjects.Image;
  private targetSize: { width: number; height: number } = { ...ACTION_TARGET_SIZES.girl };
  private baseScaleX = 1;
  private baseScaleY = 1;
  private bobPhase = 0;

  // ---- N1 'tap-target' -------------------------------------------------------
  /** La niña está en su mini-estallido de susto (invisible, intocable). */
  private girlHidden = false;
  private scareEvent: Phaser.Time.TimerEvent | null = null;

  // ---- N2 'cane-strike' ------------------------------------------------------
  /** Pool del bastón de mango blanco (2 sprites, SPEC §10.4). */
  private readonly canes: Phaser.GameObjects.Image[] = [];
  private caneIndex = 0;
  private caneTextureKey = 'cane';
  private victoryLine: string | null = null;
  /** Hop de esquiva: offset en un objeto plano (no pisa el bob por frame). */
  private readonly hopOffset: { y: number } = { y: 0 };
  private readonly stars: TwinklingStar[] = [];

  // ---- N3 'transform-target' -------------------------------------------------
  private door!: Phaser.GameObjects.Image;
  private poole!: Phaser.GameObjects.Image;
  private utterson!: Phaser.GameObjects.Image;
  private aura!: Phaser.GameObjects.Image;
  private notice: Phaser.GameObjects.Container | null = null;
  /** Espejo de `state.form` para disparar las animaciones de transformación. */
  private form: TargetForm = TargetForm.Hyde;
  private introEvents: Phaser.Time.TimerEvent[] = [];

  // ---- Compartido -------------------------------------------------------------
  private lastTickedSecond: number | null = null;
  private gameOverShown = false;
  private exiting = false;
  private fallingPlayed = false;
  private victoryShown = false;
  private entrancePlayed = false;
  private fpsText: Phaser.GameObjects.Text | null = null;
  private fpsUpdatedAt = 0;

  constructor() {
    super(SceneKey.ACTION);
  }

  init(data: ActionSceneData = {}): void {
    this.level = activeLevelFor(data.levelId);
    this.action = this.level.action;
    const config = this.action;

    // Despacho por mecánica (el guard de la Fase 1 ya no hace falta: las
    // tres mecánicas de la unión `ActionConfig` están implementadas). Cada
    // rama fija SU reducer puro y SU movimiento; el resto de la escena es
    // compartida (HUD, pools, overlay, bonus, pausa).
    switch (config.mechanic) {
      case 'tap-target': {
        // N1: los eventos del reducer siguen siendo ActionEventType.Hit,
        // ActionEventType.Miss, ActionEventType.Tick y ActionEventType.Restart —
        // estructuralmente idénticos al subconjunto de RoundEventType que
        // consume `actionReducer` (glue tipado en gameplay/round).
        this.mechanic = config.mechanic;
        this.state = initialActionState({
          goal: config.goal,
          timeLimitSec: config.timeLimitSec,
        });
        const reduce = adaptRoundReducer(actionReducer);
        this.dispatchRound = (event): void => {
          this.state = reduce(this.state, event);
        };
        this.erraticOptions = {
          speedRange: config.target.speedRange,
          dirChangeMs: config.target.dirChangeMs,
          bounds: ACTION_LAYOUT.playZone,
        };
        this.jekyllOptions = null;
        break;
      }
      case 'cane-strike': {
        this.mechanic = config.mechanic;
        this.state = initialCaneState({
          goal: config.goal,
          timeLimitSec: config.timeLimitSec,
          fallMs: FALL_SEQUENCE.tweenMs + FALL_SEQUENCE.settleMs,
          lineMs: VICTORY_LINE.holdMs,
        });
        const reduce = adaptRoundReducer(caneReducer);
        this.dispatchRound = (event): void => {
          this.state = reduce(this.state, event);
        };
        this.erraticOptions = {
          speedRange: config.target.speedRange,
          dirChangeMs: config.target.dirChangeMs,
          bounds: ACTION_LAYOUT.playZone,
        };
        this.jekyllOptions = null;
        this.caneTextureKey = config.caneTexture;
        this.victoryLine = config.victoryLine;
        break;
      }
      case 'transform-target': {
        this.mechanic = config.mechanic;
        this.state = initialTransformState({
          goal: config.goal,
          timeLimitSec: config.timeLimitSec,
          revertMs: config.revertMs,
          fallMs: FALL_SEQUENCE.tweenMs + FALL_SEQUENCE.settleMs,
        });
        const reduce = adaptRoundReducer(transformReducer);
        this.dispatchRound = (event): void => {
          this.state = reduce(this.state, event);
        };
        this.erraticOptions = {
          speedRange: config.target.speedRange,
          dirChangeMs: config.target.dirChangeMs,
          bounds: ACTION_LAYOUT.playZone,
        };
        // Tregua de Jekyll: mismos bounds, velocidad reducida (DATOS).
        const [minSpeed, maxSpeed] = config.target.speedRange;
        this.jekyllOptions = {
          ...this.erraticOptions,
          speedRange: [minSpeed * JEKYLL_SPEED_FACTOR, maxSpeed * JEKYLL_SPEED_FACTOR],
        };
        break;
      }
    }

    this.erratic = initialErraticState(Math.random, this.erraticOptions);
    this.form = TargetForm.Hyde;
    this.threat = null;
    this.exiting = false;
    this.gameOverShown = false;
    this.girlHidden = false;
    this.lastTickedSecond = null;
    this.scareEvent = null;
    this.puffs.length = 0;
    this.canes.length = 0;
    this.caneIndex = 0;
    this.stars.length = 0;
    this.introEvents.length = 0;
    this.fallingPlayed = false;
    this.victoryShown = false;
    this.entrancePlayed = false;
    this.hopOffset.y = 0;
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

    // Fondo por mecánica (DATOS de actionLayout): callejón para N1/N2,
    // interior del laboratorio para N3.
    const background = ACTION_BACKGROUNDS[this.mechanic];
    this.field = new ParallaxField(this, {
      layers: background.layers,
      ground: { color: background.groundColor, y: ACTION_LAYOUT.groundY },
    });

    if (background.stars) {
      this.buildStars(); // cielo del N2: 5 estrellas titilando (barato)
    }
    if (this.mechanic === 'transform-target') {
      this.buildLabProps();
      this.buildAura();
      this.startSiegeIntro();
    }

    this.buildTarget();
    this.buildPuffPool();
    if (this.mechanic === 'cane-strike') {
      this.buildCanePool();
    }
    this.buildGameOverOverlay();
    this.buildDebugFps();

    this.hud = new Hud(this, {
      hudLabel: this.hudLabel(),
      goal: this.state.goal,
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
    const previousPhase = this.state.phase;
    this.dispatchRound({ type: RoundEventType.Tick, dtMs });

    // Transiciones de fase (una sola vez): las detecta la ESCENA, pero las
    // decide el REDUCER — aquí solo se animan.
    if (this.state.phase === 'timeout' && previousPhase !== 'timeout') {
      this.onTimeout();
    }
    if (this.state.phase === 'falling' && previousPhase !== 'falling') {
      this.playFall();
    }
    if (this.state.phase === 'line' && previousPhase !== 'line') {
      this.showVictoryLine();
    }
    if (this.state.phase === 'goal' && previousPhase !== 'goal') {
      this.onGoal();
    }
    if (this.mechanic === 'transform-target') {
      this.syncTransformForm();
    }

    if (this.state.phase === ActionPhase.Playing) {
      // Tick sonoro: últimos 5 s, un tick por SEGUNDO mostrado (sin dobles).
      if (shouldTick(this.state.timeLeftMs, this.lastTickedSecond)) {
        this.lastTickedSecond = tickSecond(this.state.timeLeftMs);
        this.systems.audioSystem.tick();
      }
      // Movimiento del objetivo (rng de runtime; las funciones puras son
      // deterministas con el rng inyectado — los tests inyectan secuencias).
      this.erratic = this.stepTarget(dtMs);
    }

    this.hud.setTimeLeft(this.state.timeLeftMs);
    this.renderTarget(t);
    if (this.mechanic === 'cane-strike') {
      this.twinkleStars(t);
    }
    this.updateDebugFps(time);
  }

  // ---- Construcción ---------------------------------------------------------

  /** Etiqueta del HUD según la mecánica (del ActionConfig, DATOS). */
  private hudLabel(): string {
    return this.action.hudLabel; // todas las variantes la declaran
  }

  /** Textura y tamaño de despliegue del objetivo de la mecánica. */
  private initialTargetAppearance(): { texture: string; sizeKey: keyof typeof ACTION_TARGET_SIZES } {
    const config = this.action;
    switch (config.mechanic) {
      case 'tap-target':
        return { texture: config.target.texture, sizeKey: 'girl' };
      case 'cane-strike':
        return { texture: config.target.texture, sizeKey: 'lanyon' };
      case 'transform-target':
        return { texture: config.target.textureHyde, sizeKey: 'hyde' };
    }
  }

  /** Fija textura + tamaño de despliegue del objetivo (y guarda su escala). */
  private applyTargetAppearance(texture: string, sizeKey: keyof typeof ACTION_TARGET_SIZES): void {
    const size = ACTION_TARGET_SIZES[sizeKey];
    this.targetSize = { width: size.width, height: size.height };
    this.target.setTexture(texture).setDisplaySize(size.width, size.height);
    this.baseScaleX = this.target.scaleX;
    this.baseScaleY = this.target.scaleY;
  }

  private buildTarget(): void {
    const appearance = this.initialTargetAppearance();
    this.target = this.add
      .image(this.erratic.x, this.erratic.y, appearance.texture)
      .setDepth(ACTION_LAYOUT.depths.girl);
    this.applyTargetAppearance(appearance.texture, appearance.sizeKey);
    this.bobPhase = Math.random() * Math.PI * 2;
    // N3: el objetivo aparece cuando la intro abre la puerta.
    if (this.mechanic === 'transform-target' && this.state.phase === 'intro') {
      this.target.setVisible(false);
    }
  }

  /** Props del laboratorio (N3): puerta asediada, mesa, frascos, golpeatores. */
  private buildLabProps(): void {
    const props = ACTION_LAB_PROPS;
    const { depths } = ACTION_LAYOUT;
    this.add
      .image(props.bench.x, props.bench.y, TEXTURE_KEYS.labBench)
      .setDisplaySize(props.bench.width, props.bench.height)
      .setDepth(depths.props);
    this.add
      .image(props.flaskA.x, props.flaskA.y, TEXTURE_KEYS.labFlask)
      .setDisplaySize(props.flaskA.width, props.flaskA.height)
      .setTint(hexToNumber(potionPurple))
      .setDepth(depths.props);
    this.add
      .image(props.flaskB.x, props.flaskB.y, TEXTURE_KEYS.labFlask)
      .setDisplaySize(props.flaskB.width, props.flaskB.height)
      .setTint(hexToNumber(labGreen))
      .setDepth(depths.props);
    // La puerta NACE cerrada (alpha 1): la intro la abre ante el jugador.
    this.door = this.add
      .image(props.door.x, props.door.y, TEXTURE_KEYS.labDoor)
      .setDisplaySize(props.door.width, props.door.height)
      .setDepth(depths.props);
    this.poole = this.add
      .image(props.poole.x, props.poole.y, TEXTURE_KEYS.poole)
      .setDisplaySize(props.poole.width, props.poole.height)
      .setDepth(depths.props);
    this.utterson = this.add
      .image(props.utterson.x, props.utterson.y, TEXTURE_KEYS.utterson)
      .setDisplaySize(props.utterson.width, props.utterson.height)
      .setDepth(depths.props);
    this.buildJekyllNotice();
  }

  /** Mini-placa pedagógica (N3): panel pergamino + mensaje amable, oculta. */
  private buildJekyllNotice(): void {
    const data = JEKYLL_MISS_NOTICE;
    const container = this.add
      .container(BASE_WIDTH / 2, data.y)
      .setDepth(ACTION_LAYOUT.depths.feedback)
      .setVisible(false)
      .setAlpha(0);
    const panel = this.add
      .image(0, 0, GAME_OVER_OVERLAY.panel.textureKey)
      .setDisplaySize(520, 110);
    const label = this.add
      .text(0, 0, data.text, {
        fontFamily: data.textStyle.fontFamily,
        fontSize: `${data.textStyle.fontSize}px`,
        color: data.textStyle.color,
        align: 'center',
        wordWrap: { width: data.wrapWidth },
      })
      .setOrigin(0.5);
    container.add([panel, label]);
    this.notice = container;
  }

  /** Aura púrpura de la transformación (un sprite del pool, tintado). */
  private buildAura(): void {
    this.aura = this.add
      .image(0, 0, TEXTURE_KEYS.fogPuff)
      .setTint(hexToNumber(potionPurple))
      .setDepth(ACTION_LAYOUT.depths.aura)
      .setAlpha(0)
      .setVisible(false);
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

  /** Pool del bastón de mango blanco (N2): 2 swings consecutivos sin pisarse. */
  private buildCanePool(): void {
    for (let i = 0; i < CANE_SWING.poolSize; i++) {
      this.canes.push(
        this.add
          .image(0, 0, this.caneTextureKey)
          .setDepth(ACTION_LAYOUT.depths.effects)
          .setVisible(false),
      );
    }
  }

  /** Cielo del N2: 5 estrellas (pool acotado; titileo = asignar alpha). */
  private buildStars(): void {
    STAR_TWINKLE.slots.forEach((slot, index) => {
      const sprite = this.add
        .image(slot.x, slot.y, TEXTURE_KEYS.star)
        .setScale(slot.scale)
        .setAlpha(STAR_TWINKLE.minAlpha)
        .setDepth(0.8); // tras TODO el parallax (cielo)
      this.stars.push({ sprite, phase: index * 1.7 });
    });
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

  // ---- Intro del asedio (N3): fase 'intro' del reducer, timer parado ----------

  /** Cinemática de la puerta: 3–4 golpes, apertura y arranque del juego. */
  private startSiegeIntro(): void {
    const intro = SIEGE_INTRO;
    const lunge = ACTION_LAB_PROPS.knockLunge;
    for (let i = 0; i < intro.knockCount; i++) {
      this.introEvents.push(
        this.time.delayedCall(200 + i * intro.knockIntervalMs, () => {
          // Temblor de PANTALLA con cada golpe (SPEC: shake corto + knock).
          this.cameras.main.shake(intro.shakeMs, intro.shakeIntensity);
          this.systems.audioSystem.knock();
          // Empujón de los golpeatores (barato: tween yoyo sobre 2 sprites).
          for (const knocker of [this.poole, this.utterson]) {
            this.tweens.add({
              targets: knocker,
              y: knocker.y - lunge.px,
              duration: lunge.ms,
              yoyo: true,
              ease: 'Sine.easeOut',
            });
          }
        }),
      );
    }
    const openAt = 200 + intro.knockCount * intro.knockIntervalMs;
    this.introEvents.push(this.time.delayedCall(openAt, () => this.openLabDoor()));
    this.introEvents.push(
      this.time.delayedCall(openAt + intro.doorOpenMs + intro.settleMs, () =>
        this.finishSiegeIntro(),
      ),
    );
  }

  /** La puerta cede: fade a alpha de puerta abierta (y se queda abierta). */
  private openLabDoor(): void {
    this.tweens.add({
      targets: this.door,
      alpha: ACTION_LAB_PROPS.door.openAlpha,
      duration: SIEGE_INTRO.doorOpenMs,
      ease: 'Sine.easeInOut',
    });
    this.systems.audioSystem.noise(0.35); // crujido grave de la puerta
  }

  /** Fin de la intro: despacha `start` (el reloj arranca en el próximo tick). */
  private finishSiegeIntro(): void {
    if (this.state.phase !== 'intro') {
      return; // ya saltada/arrancada (skip idempotente)
    }
    this.clearIntroEvents();
    this.poole.setVisible(false); // siguen golpeando… pero fuera de vista
    this.utterson.setVisible(false);
    this.target.setVisible(true).setPosition(this.erratic.x, this.erratic.y);
    this.dispatchRound({ type: RoundEventType.Start });
  }

  /** La intro es skipeable con un tap (accesibilidad, SPEC §9). */
  private skipSiegeIntro(): void {
    if (this.state.phase !== 'intro') {
      return;
    }
    this.clearIntroEvents();
    this.tweens.killTweensOf(this.door);
    this.door.setAlpha(ACTION_LAB_PROPS.door.openAlpha); // estado final directo
    this.finishSiegeIntro();
  }

  private clearIntroEvents(): void {
    for (const event of this.introEvents) {
      event.remove(false);
    }
    this.introEvents.length = 0;
  }

  // ---- Input ------------------------------------------------------------------

  /**
   * Un pointerdown: hit-test geométrico puro contra la hitbox +20 % del
   * objetivo (posición LÓGICA errática — el bob visual es ±4 px, holgadamente
   * dentro de la expansión). Durante la intro del N3, un tap LA SALTA.
   */
  private onPointerDown(
    pointer: Phaser.Input.Pointer,
    currentlyOver: Phaser.GameObjects.GameObject[],
  ): void {
    if (this.exiting) {
      return;
    }
    // El tap cayó sobre UI interactiva (botón pausa / overlay): es suyo.
    if (currentlyOver.length > 0) {
      return;
    }
    if (this.state.phase === TransformPhase.Intro) {
      this.skipSiegeIntro();
      return;
    }
    if (this.state.phase !== ActionPhase.Playing) {
      return;
    }

    const point = { x: pointer.worldX, y: pointer.worldY };
    if (this.mechanic === 'cane-strike') {
      // N2: el tap es una AMENAZA — Lanyon huirá de este punto (stepFlee).
      this.threat = point;
    }

    // N3: si el objetivo es JEKYLL, el tap no puede golpear (invulnerable).
    if (this.mechanic === 'transform-target' && this.form === TargetForm.Jekyll) {
      if (isHit(point, this.targetBox())) {
        this.onJekyllTap(point);
      } else {
        this.onMiss(point);
      }
      return;
    }

    if (isHit(point, this.targetBox())) {
      this.onHit(point);
    } else if (
      this.mechanic === 'cane-strike' &&
      isHit(point, this.targetBox(), NEAR_MISS_HOP.expansion)
    ) {
      this.onNearMiss(point); // cerca pero fuera: hop de esquiva, sin castigo
    } else {
      this.onMiss(point);
    }
  }

  /** Caja lógica del objetivo (centro errático + tamaño de despliegue). */
  private targetBox(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.erratic.x,
      y: this.erratic.y,
      width: this.targetSize.width,
      height: this.targetSize.height,
    };
  }

  /** Tap exitoso: feedback + el reducer decide (hit → animación de mecánica). */
  private onHit(point: { x: number; y: number }): void {
    const previousPhase = this.state.phase;
    this.dispatchRound({ type: RoundEventType.Hit });
    this.systems.scoreSystem.add(TAP_POINTS, SCORE_CATEGORY.taps); // +10 (SPEC §5)
    this.hud.setHits(this.state.hits);

    // Feedback (SPEC §4.2/§7.2): flash blanco + micro-shake + «!» + «+10»
    // + sonido compuesto (thump grave + click agudo, SPEC §8). El flash usa
    // el blanco cálido del texto de la paleta (#e8e3d5), no un blanco puro.
    const { r, g, b } = hexToRgb(textPrimary);
    this.cameras.main.flash(ACTION_FEEDBACK.flashMs, r, g, b);
    this.cameras.main.shake(ACTION_FEEDBACK.shakeMs, ACTION_FEEDBACK.shakeIntensity);
    this.systems.audioSystem.thump();
    this.systems.audioSystem.blip(0.07, 1150, 780);
    this.floatText('!', this.target.x, this.target.y - this.targetSize.height / 2 - 12, ACTION_FLOAT_STYLE.exclamation, -46);
    this.floatText('+10', this.target.x + 74, this.target.y - 30, ACTION_FLOAT_STYLE.points, -36);

    if (this.mechanic === 'cane-strike') {
      this.playCaneSwing(point); // el bastón entra con su swing teatral
    }
    if (this.state.phase === 'goal' && previousPhase !== 'goal') {
      this.onGoal();
      return;
    }
    if (this.mechanic === 'tap-target') {
      // «Sale corriendo asustada pero ilesa»: mini-estallido + reaparición.
      this.scareGirl();
    }
    // N2/N3: la fase `falling` (caída final) la detecta update() — el
    // reducer es quien decide; y la transformación de N3 la detecta
    // syncTransformForm() con el espejo de forma.
  }

  /**
   * Tap sobre JEKYLL (N3): miss pedagógico sin castigo — mini-placa amable
   * (no es Hyde todavía) + puff suave. El reducer ni se entera (miss no-op).
   */
  private onJekyllTap(point: { x: number; y: number }): void {
    this.spawnPuff(point.x, point.y, 0);
    this.systems.audioSystem.noise(0.1);
    this.systems.audioSystem.blip(0.1, 420, 260);
    this.showJekyllNotice();
  }

  /** Near-miss del N2: Lanyon da un hop de esquiva (feedback vivo, sin castigo). */
  private onNearMiss(point: { x: number; y: number }): void {
    this.spawnPuff(point.x, point.y, 0);
    this.systems.audioSystem.noise(0.12);
    this.systems.audioSystem.blip(0.09, 700, 950);
    this.tweens.killTweensOf(this.hopOffset);
    this.hopOffset.y = 0;
    this.tweens.add({
      targets: this.hopOffset,
      y: -NEAR_MISS_HOP.hopPx,
      duration: NEAR_MISS_HOP.ms / 2,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.hopOffset.y = 0;
      },
    });
  }

  /** Tap al aire: puff de niebla + sonido suave, SIN castigo (SPEC §4.2). */
  private onMiss(point: { x: number; y: number }): void {
    this.spawnPuff(point.x, point.y, 0);
    this.systems.audioSystem.noise(0.12);
  }

  // ---- Finales de tanda --------------------------------------------------------

  /** Meta: bonus de tiempo (+ secuencia de salida por mecánica) → fade a QUIZ. */
  private onGoal(): void {
    // Bonus por tiempo restante: 2 pts/s con floor (se suma UNA vez).
    const bonus = timeBonus(this.state.timeLeftMs);
    if (bonus > 0) {
      this.systems.scoreSystem.add(bonus, SCORE_CATEGORY.timeBonus);
      this.floatText(`+${bonus}`, BASE_WIDTH / 2, BASE_HEIGHT / 2 - 60, ACTION_FLOAT_STYLE.points, -44);
    }

    if (this.mechanic === 'tap-target') {
      // La niña huye de la pantalla asustada (pero ilesa) por donde iba.
      const fleeX = this.erratic.vx >= 0 ? BASE_WIDTH + 180 : -180;
      this.tweens.add({
        targets: this.target,
        x: fleeX,
        duration: ACTION_FEEDBACK.fleeMs,
        ease: 'Sine.easeIn',
      });
      this.systems.audioSystem.noise(0.22); // pasos que se pierden en la niebla
    }
    if (this.mechanic === 'transform-target') {
      this.playEntrance(); // Poole y Utterson entran al laboratorio
    }

    // N1/N2: cola estándar tras la huida/línea; N3: espera la caminata.
    const exitDelayMs =
      this.mechanic === 'transform-target'
        ? SIEGE_ENTRANCE.walkMs + SIEGE_ENTRANCE.settleMs
        : ACTION_FEEDBACK.exitDelayMs;
    this.time.delayedCall(exitDelayMs, () => {
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
    this.clearIntroEvents();
    this.hideAura();
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
    // El MISMO evento de reinicio para las tres mecánicas: RoundEventType.Restart
    // es literalmente ActionEventType.Restart ('restart') — la unión de eventos
    // de gameplay/round es estructuralmente idéntica a ActionEvent de N1.
    this.dispatchRound({ type: RoundEventType.Restart });
    this.lastTickedSecond = null;
    this.gameOverShown = false;
    this.overlay.setVisible(false);

    // El objetivo vuelve al centro de la zona, en pie y golpeable.
    this.cancelScare();
    this.girlHidden = false;
    this.tweens.killTweensOf(this.target);
    this.target.setVisible(true).setRotation(0).setAlpha(1);
    this.resetMechanicsAfterRetry();
    this.erratic = initialErraticState(Math.random, this.erraticOptions);
    this.target.setPosition(this.erratic.x, this.erratic.y);

    this.hud.setHits(this.state.hits);
    this.hud.setTimeLeft(this.state.timeLeftMs);
  }

  /** Reset de las piezas por mecánica tras «Reintentar» (el timer ya no corre). */
  private resetMechanicsAfterRetry(): void {
    this.threat = null; // N2: sin amenaza recordada
    this.hopOffset.y = 0;
    this.fallingPlayed = false;
    this.victoryShown = false;
    this.entrancePlayed = false;
    if (this.mechanic === 'transform-target') {
      // Vuelve Hyde (textura/tamaño), aura apagada, golpeatores fuera.
      this.form = TargetForm.Hyde;
      const config = this.action as TransformTargetActionConfig;
      this.applyTargetAppearance(config.target.textureHyde, 'hyde');
      this.hideAura();
      this.poole.setVisible(false);
      this.utterson.setVisible(false);
    }
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

  // ---- Secuencias por mecánica (animan lo que el reducer decide) ---------------

  /** N1: la niña «sale corriendo asustada pero ilesa» y reaparece (D4). */
  private scareGirl(): void {
    this.cancelScare();
    this.girlHidden = true;
    this.target.setVisible(false);
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
      this.target.setVisible(true);
    });
  }

  private cancelScare(): void {
    if (this.scareEvent) {
      this.scareEvent.remove(false);
      this.scareEvent = null;
    }
    this.girlHidden = false;
  }

  /** N2: swing del bastón de mango blanco sobre el punto del golpe. */
  private playCaneSwing(point: { x: number; y: number }): void {
    const cane = this.canes[this.caneIndex % this.canes.length];
    this.caneIndex++;
    this.tweens.killTweensOf(cane);
    cane
      .setVisible(true)
      .setOrigin(CANE_SWING.originX, 0.5)
      .setPosition(point.x + CANE_SWING.offsetX, point.y + CANE_SWING.offsetY)
      .setRotation(CANE_SWING.fromRad)
      .setScale(1)
      .setAlpha(0);
    // Aparece mientras arma el golpe…
    this.tweens.add({
      targets: cane,
      alpha: CANE_SWING.alpha,
      duration: CANE_SWING.ms * 0.25,
    });
    // …baja al impacto…
    this.tweens.add({
      targets: cane,
      rotation: CANE_SWING.toRad,
      duration: CANE_SWING.ms * CANE_SWING.strikeFraction,
      ease: 'Cubic.easeIn',
    });
    // …y sale de escena (pool: el sprite vuelve a quedar libre).
    this.tweens.add({
      targets: cane,
      alpha: 0,
      duration: CANE_SWING.ms * 0.45,
      delay: CANE_SWING.ms * CANE_SWING.strikeFraction,
      onComplete: () => cane.setVisible(false),
    });
  }

  /** N2/N3: el objetivo cae al suelo (rotación + rebote) y SE QUEDA caído. */
  private playFall(): void {
    if (this.fallingPlayed) {
      return;
    }
    this.fallingPlayed = true;
    this.tweens.killTweensOf(this.hopOffset);
    this.hopOffset.y = 0;
    this.hideAura();
    // Cae hacia el costado hacia el que iba; tumbado sobre la línea de suelo.
    const side = this.erratic.vx >= 0 ? 1 : -1;
    const lieY = ACTION_LAYOUT.groundY - this.targetSize.width / 2 - FALL_SEQUENCE.lieLiftPx;
    this.tweens.add({
      targets: this.target,
      y: lieY,
      duration: FALL_SEQUENCE.tweenMs,
      ease: 'Bounce.easeOut', // el rebote del cuerpazo, sin sangre (D4)
    });
    this.tweens.add({
      targets: this.target,
      rotation: side * FALL_SEQUENCE.rotationRad,
      duration: FALL_SEQUENCE.tweenMs,
      ease: 'Bounce.easeOut',
    });
    // Puffs de niebla alrededor del caído (escenografía del callejón/lab).
    for (let i = 0; i < FALL_SEQUENCE.groundPuffs; i++) {
      this.spawnPuff(this.erratic.x + (i - 1) * 42, ACTION_LAYOUT.groundY - 24, i * 90);
    }
    this.systems.audioSystem.thump(0.3, 90, 35);
    this.systems.audioSystem.noise(0.25);
  }

  /** N2: línea de victoria de Hyde en pergamino (fase `line` del reducer). */
  private showVictoryLine(): void {
    if (this.victoryShown || this.victoryLine === null) {
      return;
    }
    this.victoryShown = true;
    const data = VICTORY_LINE;
    const container = this.add
      .container(BASE_WIDTH / 2, data.panelY)
      .setDepth(ACTION_LAYOUT.depths.victory)
      .setAlpha(0)
      .setScale(data.popFromScale);
    const panel = this.add
      .image(0, 0, data.textureKey)
      .setDisplaySize(data.panelWidth, data.panelHeight);
    const line = this.add
      .text(0, data.textOffsetY, this.victoryLine, {
        fontFamily: data.textStyle.fontFamily,
        fontSize: `${data.textStyle.fontSize}px`,
        color: data.textStyle.color,
        align: 'center',
        wordWrap: { width: data.textStyle.wordWrapWidth },
      })
      .setOrigin(0.5);
    container.add([panel, line]);
    // Pop-in elástico de la carátula (Hyde se burla: es teatro gótico).
    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: data.popMs,
      ease: 'Back.easeOut',
    });
    this.systems.audioSystem.blip(0.18, 260, 150); // risa grave al speak
  }

  /** N3: espejo de `state.form` → dispara la animación de transformación. */
  private syncTransformForm(): void {
    const transformState = this.state as TransformState;
    if (transformState.form === this.form) {
      return;
    }
    this.form = transformState.form;
    this.playTransformAnimation(this.form);
  }

  /** N3: flash pálido + aura púrpura pulsante + wobble (ambas direcciones). */
  private playTransformAnimation(toForm: TargetForm): void {
    const anim = TRANSFORM_ANIM;
    // Flash pálido (pergamino, no blanco puro — estética cálida).
    const { r, g, b } = hexToRgb(parchmentLight);
    this.cameras.main.flash(anim.flashMs, r, g, b);
    // Wobble de escala en contrafase (relativo a la escala base del sprite).
    this.tweens.killTweensOf(this.target);
    this.tweens.add({
      targets: this.target,
      scaleX: {
        from: this.baseScaleX * (1 - anim.wobbleScaleX),
        to: this.baseScaleX * (1 + anim.wobbleScaleX),
      },
      scaleY: {
        from: this.baseScaleY * (1 + anim.wobbleScaleY),
        to: this.baseScaleY * (1 - anim.wobbleScaleY),
      },
      duration: anim.wobbleMs / 2,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => this.target.setScale(this.baseScaleX, this.baseScaleY),
    });
    // La textura se intercambia a MITAD del wobble (punto álgido del flash).
    this.time.delayedCall(anim.wobbleMs / 2, () => {
      if (this.exiting) {
        return;
      }
      const config = this.action as TransformTargetActionConfig;
      if (toForm === TargetForm.Jekyll) {
        this.applyTargetAppearance(config.target.textureJekyll, 'jekyll');
      } else {
        this.applyTargetAppearance(config.target.textureHyde, 'hyde');
      }
    });
    // Aura púrpura: pulsa en bucle mientras dura la forma (se apaga al revertir).
    this.aura.setPosition(this.erratic.x, this.erratic.y).setVisible(true);
    this.tweens.killTweensOf(this.aura);
    this.aura.setAlpha(0.08).setScale(anim.auraScaleFrom);
    if (toForm === TargetForm.Jekyll) {
      this.tweens.add({
        targets: this.aura,
        scale: anim.auraScaleTo,
        alpha: { from: 0.08, to: anim.auraAlpha },
        duration: anim.auraMs / (anim.auraPulses * 2),
        yoyo: true,
        repeat: -1, // pulsa hasta que Hyde vuelva
        ease: 'Sine.easeInOut',
      });
      this.systems.audioSystem.blip(0.14, 620, 180); // caída mágica
    } else {
      this.systems.audioSystem.blip(0.12, 180, 640); // reverso ascendente
    }
  }

  /** Apaga la aura de la transformación (retry, timeout, caída final). */
  private hideAura(): void {
    if (!this.aura) {
      return;
    }
    this.tweens.killTweensOf(this.aura);
    this.aura.setVisible(false).setAlpha(0);
  }

  /** N3: mini-placa pedagógica al golpear a Jekyll (tono amable, SPEC §9). */
  private showJekyllNotice(): void {
    if (!this.notice) {
      return; // solo existe en la mecánica transform-target
    }
    const notice = this.notice;
    this.tweens.killTweensOf(notice);
    notice.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: notice,
      alpha: { from: 0, to: 1 },
      duration: 160,
      yoyo: true,
      hold: Math.max(0, JEKYLL_MISS_NOTICE.ms - 320), // se lee, respira y se va
      ease: 'Sine.easeOut',
      onComplete: () => notice.setVisible(false),
    });
  }

  /** N3: Poole y Utterson entran al laboratorio caminando (puerta abierta). */
  private playEntrance(): void {
    if (this.entrancePlayed) {
      return;
    }
    this.entrancePlayed = true;
    const entrance = SIEGE_ENTRANCE;
    const props = ACTION_LAB_PROPS;
    // Entran caminando desde costados opuestos, con leve bob de paso.
    this.poole
      .setVisible(true)
      .setAlpha(1)
      .setPosition(-120, props.poole.y)
      .setRotation(0);
    this.utterson
      .setVisible(true)
      .setAlpha(1)
      .setPosition(BASE_WIDTH + 120, props.utterson.y)
      .setRotation(0);
    this.tweens.add({
      targets: this.poole,
      x: props.poole.x,
      duration: entrance.walkMs,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: this.utterson,
      x: props.utterson.x,
      duration: entrance.walkMs,
      delay: entrance.secondDelayMs,
      ease: 'Sine.easeOut',
    });
    // Bob de caminata: objetos planos (no pisa el tween de x).
    for (const [index, walker] of [this.poole, this.utterson].entries()) {
      const bob = { y: 0 };
      this.tweens.add({
        targets: bob,
        y: -entrance.bobPx,
        duration: entrance.walkMs / (entrance.bobRepeats * 2),
        yoyo: true,
        repeat: entrance.bobRepeats - 1,
        delay: index * entrance.secondDelayMs,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          walker.setY(props[index === 0 ? 'poole' : 'utterson'].y + bob.y);
        },
        onComplete: () => walker.setY(props[index === 0 ? 'poole' : 'utterson'].y),
      });
    }
    this.systems.audioSystem.noise(0.3); // pasos dentro del laboratorio
    this.time.delayedCall(entrance.walkMs * 0.5, () => this.systems.audioSystem.thump(0.2, 80, 45));
  }

  // ---- Feedback visual (barato: tweens sobre pocos objetos) --------------------

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

  // ---- Movimiento y render por frame --------------------------------------------

  /** Paso de movimiento del objetivo según la mecánica (FUNCIONES PURAS). */
  private stepTarget(dtMs: number): ErraticState {
    if (this.mechanic === 'cane-strike') {
      // N2: huida errática — Lanyon tiende a alejarse del último tap.
      return stepFlee(this.erratic, dtMs, Math.random, this.erraticOptions, this.threat);
    }
    if (this.mechanic === 'transform-target' && this.form === TargetForm.Jekyll && this.jekyllOptions) {
      // N3: en forma Jekyll la tregua lo hace moverse más lento.
      return stepErratic(this.erratic, dtMs, Math.random, this.jekyllOptions);
    }
    return stepErratic(this.erratic, dtMs, Math.random, this.erraticOptions);
  }

  /** Refleja el estado errático + la animación de caminar (bob/tilt baratos). */
  private renderTarget(tSec: number): void {
    const phase = this.state.phase;
    // En goal huye por tween; en falling/line queda caído; en timeout
    // congelado; en intro aún no apareció (N3).
    if (
      phase !== ActionPhase.Playing &&
      phase !== CanePhase.Restart &&
      phase !== TransformPhase.Ready
    ) {
      return;
    }
    if (this.girlHidden) {
      return;
    }
    const bob = Math.sin(tSec * GIRL_WALK_BOB.speed + this.bobPhase) * GIRL_WALK_BOB.amplitudePx;
    const tilt = Math.sin(tSec * GIRL_WALK_BOB.tiltSpeed + this.bobPhase) * GIRL_WALK_BOB.tiltRad;
    this.target.setPosition(this.erratic.x, this.erratic.y + bob + this.hopOffset.y);
    this.target.setRotation(tilt);
    // La aura sigue al objetivo mientras Jekyll deambula (N3).
    if (this.aura && this.aura.visible) {
      this.aura.setPosition(this.erratic.x, this.erratic.y + bob);
    }
  }

  /** Titileo de las estrellas del N2 (alpha por frame, sin tweens). */
  private twinkleStars(tSec: number): void {
    for (const star of this.stars) {
      const wave = Math.sin(tSec * STAR_TWINKLE.speed + star.phase) * 0.5 + 0.5;
      star.sprite.alpha = STAR_TWINKLE.minAlpha + wave * (1 - STAR_TWINKLE.minAlpha);
    }
  }

  private updateDebugFps(time: number): void {
    if (!this.fpsText || time - this.fpsUpdatedAt < 500) {
      return; // 2 lecturas por segundo es suficiente (EMA del loop)
    }
    this.fpsUpdatedAt = time;
    this.fpsText.setText(`${Math.round(this.game.loop.actualFps)} FPS`);
  }
}
