/**
 * NARRATIVE (SPEC §3, §4.1 / PLAN Etapa 3): escena GENÉRICA que renderiza
 * los paneles de `lore[]` del `LevelConfig` activo.
 *
 *  - Nivel activo por scene-start data `{ levelId?: number }` (`activeLevelFor`,
 *    default 1) — la escena no conoce ningún nivel concreto.
 *  - Fondo procedural por panel según `LorePanel.background` ('street'/
 *    'alley' → callejón nocturno con parallax de niebla y farolas en flicker;
 *    'lab' → laboratorio con mesa y frascos con brillo verde/púrpura):
 *    TODO lo que se pinta viene de la tabla `LORE_BACKGROUNDS` (datos).
 *  - Panel de texto estilo pergamino oscuro (`ui/Panel`): el wrap lo calcula
 *    `panelTextLayout` (puro, testeado) — nunca desborda. El parser de
 *    `**negritas**` destaca la instrucción del panel final.
 *  - Avance por tap en cualquier punto (capa de input bajo la UI) con
 *    feedback sutil (crossfade + blip); indicador «1/4 … 4/4».
 *  - Botón «Saltar» (esquina) → ACTION con fade.
 *  - Tap en el ÚLTIMO panel → transición fade + wipe de niebla (`wipeTo`).
 *
 * La progresión la decide SIEMPRE el reducer puro `narrativeProgress`.
 */
import Phaser from 'phaser';
import {
  LORE_BACKGROUNDS,
  NARRATIVE_PANEL_LAYOUT,
  NARRATIVE_PANEL_STYLE,
  NARRATIVE_SCENE_LAYOUT,
  NARRATIVE_SKIP_BUTTON,
  NARRATIVE_TEXT_STYLE,
  NarrativeAction,
  activeLevelFor,
  initialNarrativeState,
  narrativeProgress,
  narrativeStartIndex,
  panelTextLayout,
  progressLabel as progressLabelText,
  type LoreBackgroundDef,
  type LoreStarSlot,
  type NarrativeProgressState,
} from '../config/narrative';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { hexToNumber, nightBackground } from '../config/palette';
import { ParallaxField } from '../art/ParallaxField';
import { lampFlicker } from '../art/parallax';
import { TEXTURE_KEYS } from '../art/textures';
import { SceneKey } from '../config/sceneKeys';
import type { LevelConfig, LoreBackground, LorePanel } from '../config/levels/types';
import { fadeIn, transitionTo, wipeTo } from './sceneNav';
import { getSystems } from '../systems/getSystems';
import type { AudioSystem } from '../systems/AudioSystem';
import { GothicButton } from '../ui/GothicButton';
import { Panel } from '../ui/Panel';

/** Datos de arranque (`scene.start(NARRATIVE, data)`), p. ej. desde MENU. */
export interface NarrativeSceneData {
  levelId?: number;
  /**
   * True al llegar desde la cinemática de la intro: arranca en el primer
   * panel que la intro NO contó (los 1–3 ya se vieron animados).
   */
  fromIntro?: boolean;
}

/** Prop con brillo pulsante (frascos del laboratorio). */
interface GlowingProp {
  sprite: Phaser.GameObjects.Image;
  baseAlpha: number;
  phase: number;
}

export class NarrativeScene extends Phaser.Scene {
  private level!: LevelConfig;
  private progress!: NarrativeProgressState;
  private audioSystem!: AudioSystem;

  private backgroundType!: LoreBackground;
  /** Campo parallax del fondo actual (suelo + capas con deriva/flicker). */
  private field: ParallaxField | null = null;
  /** Props estáticos del fondo actual (para trocar de viñeta). */
  private backgroundObjects: Phaser.GameObjects.Image[] = [];
  private readonly glowing: GlowingProp[] = [];

  private panel!: Panel;
  private progressText!: Phaser.GameObjects.Text;
  /** Flechas del costado (adelante/atrás): la señal visible del paso de páginas. */
  private prevArrow!: Phaser.GameObjects.Image;
  private nextArrow!: Phaser.GameObjects.Image;
  /** True cuando ya se disparó la salida hacia ACTION (anti doble tap). */
  private exiting = false;

  constructor() {
    super(SceneKey.NARRATIVE);
  }

  init(data: NarrativeSceneData = {}): void {
    this.level = activeLevelFor(data.levelId);
    const total = this.level.lore.length;
    this.progress = initialNarrativeState(total, narrativeStartIndex(data.fromIntro ?? false, total));
    this.exiting = false;
    this.glowing.length = 0;
    this.backgroundObjects = [];
  }

  create(): void {
    const { audioSystem } = getSystems(this);
    this.audioSystem = audioSystem;

    fadeIn(this);
    this.cameras.main.setBackgroundColor(nightBackground);

    this.buildBackground(this.currentPanel().background, { animated: false });
    this.buildPanel();
    this.buildHud();
    this.buildNavArrows();
    this.buildTapLayer();
  }

  update(time: number): void {
    const t = time / 1000;
    this.field?.update(t);
    for (const prop of this.glowing) {
      prop.sprite.alpha = prop.baseAlpha * lampFlicker(t + prop.phase, 0.72, 1.6);
    }
  }

  private currentPanel(): LorePanel {
    return this.level.lore[Math.min(this.progress.index, this.progress.total - 1)];
  }

  // ---- Fondo procedural por viñeta (tabla LORE_BACKGROUNDS) ------------------

  /**
   * Construye el fondo del tipo pedido. Al cambiar de viñeta se troca con un
   * velo de niebla que se disipa (crossfade sin pelearse con el flicker de
   * las farolas, que sigue corriendo en `update`).
   */
  private buildBackground(type: LoreBackground, options: { animated: boolean }): void {
    const def: LoreBackgroundDef = LORE_BACKGROUNDS[type];

    if (options.animated) {
      // Velo opaco sobre el fondo viejo: cubre el trocado instantáneo y se
      // desvanece (depth 9: sobre el fondo, bajo el panel/UI).
      const veil = this.add
        .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, hexToNumber(nightBackground), 1)
        .setDepth(9);
      this.tweens.add({
        targets: veil,
        alpha: 0,
        duration: NARRATIVE_SCENE_LAYOUT.fade.backgroundMs,
        onComplete: () => veil.destroy(),
      });
    }

    // Fuera el fondo anterior; reset de los registros de animación.
    for (const obj of this.backgroundObjects) {
      obj.destroy();
    }
    this.backgroundObjects = [];
    this.glowing.length = 0;
    this.field?.destroy();
    this.field = null;
    this.backgroundType = type;

    // Suelo + capas con deriva (siluetas, niebla, farolas en flicker) — el
    // campo parallax reutilizable de la Etapa 4 come la tabla del fondo.
    this.field = new ParallaxField(this, {
      layers: def.layers,
      ground: def.ground ? { color: def.ground.color, y: def.ground.y } : undefined,
    });

    // Props estáticos encima (mesa y frascos del laboratorio).
    def.props.forEach((prop, propIndex) => {
      const sprite = this.add
        .image(prop.x, prop.y, prop.key)
        .setScale(prop.scale)
        .setAlpha(prop.alpha)
        .setDepth(prop.depth);
      if (prop.tint) {
        sprite.setTint(hexToNumber(prop.tint));
      }
      this.backgroundObjects.push(sprite);
      if (prop.glow) {
        this.glowing.push({ sprite, baseAlpha: prop.alpha, phase: propIndex * 0.9 });
      }
    });

    // Estrellas del cielo (solo exteriores): detrás de las siluetas de los
    // edificios (depth de capas ≥ 1) y titilando con fases propias.
    (def.stars ?? []).forEach((star: LoreStarSlot, starIndex) => {
      const sprite = this.add
        .image(star.x, star.y, TEXTURE_KEYS.star)
        .setScale(star.scale)
        .setAlpha(star.alpha)
        .setDepth(0.75);
      this.backgroundObjects.push(sprite);
      this.glowing.push({ sprite, baseAlpha: star.alpha, phase: starIndex * 1.7 });
    });
  }

  // ---- Panel de texto (pergamino oscuro) --------------------------------------

  private buildPanel(): void {
    const { panelCenter, depths } = NARRATIVE_SCENE_LAYOUT;
    this.panel = new Panel(this, panelCenter.x, panelCenter.y, {
      width: NARRATIVE_PANEL_LAYOUT.panelWidth,
      height: NARRATIVE_PANEL_LAYOUT.panelHeight,
      style: NARRATIVE_PANEL_STYLE,
    }).setDepth(depths.panel);

    const layout = panelTextLayout(this.currentPanel().text);
    this.panel.setWrappedLines(layout.lines, NARRATIVE_PANEL_LAYOUT, NARRATIVE_TEXT_STYLE);
    // Entrada del contenido con el mismo fade sutil del avance.
    this.panel.contentContainer.setAlpha(0);
    this.tweens.add({
      targets: this.panel.contentContainer,
      alpha: { from: 0, to: 1 },
      duration: NARRATIVE_SCENE_LAYOUT.fade.contentInMs,
      ease: 'Sine.easeInOut',
    });
  }

  // ---- Indicador de progreso + «Saltar» ---------------------------------------

  private buildHud(): void {
    const { progress, skipButton, depths, progressStyle } = NARRATIVE_SCENE_LAYOUT;
    this.progressText = this.add
      .text(progress.x, progress.y, progressLabelText(this.progress), {
        fontFamily: progressStyle.fontFamily,
        fontSize: `${progressStyle.fontSize}px`,
        color: progressStyle.color,
      })
      .setOrigin(0, 0.5)
      .setDepth(depths.ui);

    new GothicButton(this, skipButton.x, skipButton.y, {
      label: NARRATIVE_SKIP_BUTTON.label,
      layout: NARRATIVE_SKIP_BUTTON.layout,
      onPress: (): void => this.onSkip(),
    }).setDepth(depths.ui);
  }

  // ---- Flechas del costado (adelante/atrás, señal visible del paso) -----------

  /**
   * Flecha a CADA costado de la pantalla (banda del fondo, sobre el panel):
   * «atrás» a la izquierda (flipX) y «adelante» a la derecha. El tap en
   * cualquier parte sigue funcionando; las flechas son la señal VISIBLE de
   * que la historia se pasa página a página. HitArea cuadrado generoso
   * (táctil ≥ 64 px, SPEC §9).
   */
  private buildNavArrows(): void {
    const { nav, depths } = NARRATIVE_SCENE_LAYOUT;
    const hit = 100;
    const half = hit / 2;

    this.prevArrow = this.add
      .image(nav.marginX, nav.y, TEXTURE_KEYS.arrow)
      .setScale(nav.scale)
      .setFlipX(true)
      .setDepth(depths.ui)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-half, -half, hit, hit),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      })
      .on(Phaser.Input.Events.POINTER_DOWN, () => this.onNavBack());

    this.nextArrow = this.add
      .image(BASE_WIDTH - nav.marginX, nav.y, TEXTURE_KEYS.arrow)
      .setScale(nav.scale)
      .setDepth(depths.ui)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-half, -half, hit, hit),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      })
      .on(Phaser.Input.Events.POINTER_DOWN, () => this.onNavForward());

    this.updateNavArrows();
  }

  /** Estado de las flechas: «atrás» se atenúa en el primer panel. */
  private updateNavArrows(): void {
    const { nav } = NARRATIVE_SCENE_LAYOUT;
    const canGoBack = this.progress.index > 0 && !this.exiting;
    this.prevArrow.setAlpha(canGoBack ? 1 : nav.disabledAlpha);
    this.nextArrow.setAlpha(this.exiting ? nav.disabledAlpha : 1);
  }

  /** Feedback táctil del press (se restituye solo, sin pelear con otros tweens). */
  private pressFeedback(arrow: Phaser.GameObjects.Image): void {
    const { nav } = NARRATIVE_SCENE_LAYOUT;
    this.tweens.killTweensOf(arrow);
    this.tweens.add({
      targets: arrow,
      scale: { from: nav.scale * nav.pressedScale, to: nav.scale },
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  /** Flecha «atrás»: retrocede un panel (el reductor acota en el primero). */
  private onNavBack(): void {
    if (this.exiting || this.progress.index <= 0) {
      return;
    }
    this.pressFeedback(this.prevArrow);
    this.progress = narrativeProgress(this.progress, NarrativeAction.Back);
    this.renderPanel(true);
  }

  /** Flecha «adelante»: la MISMA semántica que el tap (en el último, cierra). */
  private onNavForward(): void {
    if (this.exiting) {
      return;
    }
    this.pressFeedback(this.nextArrow);
    this.onTap();
  }

  // ---- Capa de tap (avance por pointerdown) -----------------------------------

  private buildTapLayer(): void {
    // Rectángulo invisible BAJO toda la UI: con input topOnly, el botón
    // «Saltar» (depth mayor) se queda con sus taps y el resto avanza la viñeta.
    this.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x000000, 0)
      .setDepth(-1)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-BASE_WIDTH / 2, -BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      })
      .on(Phaser.Input.Events.POINTER_DOWN, () => this.onTap());
  }

  // ---- Progresión (el reducer puro decide) ------------------------------------

  private onTap(): void {
    if (this.exiting) {
      return;
    }
    const next = narrativeProgress(this.progress, NarrativeAction.Tap);
    if (next === this.progress) {
      return; // ya done (no debería llegar aquí con el guard, pero es gratis)
    }
    this.progress = next;
    if (next.done) {
      // Tap sobre el último panel: la niebla lo cubre todo → ACTION.
      this.exitToAction();
      return;
    }
    this.renderPanel(true);
  }

  private onSkip(): void {
    if (this.exiting) {
      return;
    }
    this.exiting = true;
    this.updateNavArrows();
    this.audioSystem.blip();
    // «Saltar» pide prisa: fade directo (sin wipe teatral).
    transitionTo(this, SceneKey.ACTION, { levelId: this.level.id });
  }

  private exitToAction(): void {
    this.exiting = true;
    this.updateNavArrows();
    // Sweep de viento de la transición (SPEC §8), si el gesto desbloqueó el audio.
    if (this.audioSystem.isUnlocked) {
      this.audioSystem.wind(1.6);
    }
    wipeTo(this, SceneKey.ACTION, { levelId: this.level.id });
  }

  /** Pinta el panel ACTUAL (`this.progress.index`) con feedback sutil. */
  private renderPanel(animated: boolean): void {
    const panelData = this.currentPanel();
    if (panelData.background !== this.backgroundType) {
      this.buildBackground(panelData.background, { animated: true });
    }

    this.progressText.setText(progressLabelText(this.progress));
    this.updateNavArrows();

    const layout = panelTextLayout(panelData.text);
    if (!animated) {
      this.panel.setWrappedLines(layout.lines, NARRATIVE_PANEL_LAYOUT, NARRATIVE_TEXT_STYLE);
      return;
    }

    // Feedback sutil de avance: blip + crossfade del contenido del panel.
    this.audioSystem.blip();
    const content = this.panel.contentContainer;
    this.tweens.killTweensOf(content);
    this.tweens.add({
      targets: content,
      alpha: 0,
      duration: NARRATIVE_SCENE_LAYOUT.fade.contentOutMs,
      onComplete: () => {
        this.panel.setWrappedLines(layout.lines, NARRATIVE_PANEL_LAYOUT, NARRATIVE_TEXT_STYLE);
        this.tweens.add({
          targets: content,
          alpha: { from: 0, to: 1 },
          duration: NARRATIVE_SCENE_LAYOUT.fade.contentInMs,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }
}
