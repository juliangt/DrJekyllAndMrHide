/**
 * INTRO (cinemática pre-nivel, PLAN fases 1–2/3). ACTO 1 — el laboratorio del
 * Dr. Jekyll: aparece el doctor, bebe su fórmula y se transforma —con
 * animación— en Mr. Hyde. ACTO 2 — el callejón nocturno: Hyde cruza la
 * escena, una niña con farol aparece en la esquina, Hyde la ve, avanza
 * acechando y ALZA EL BRAZO; la niña se encoge pero NADIE la toca (amenaza
 * sugerida, público 10+). El cierre dirige al jugador («Y tú eres Mr. Hyde»)
 * y al terminar (o saltar) se pasa a la narrativa del nivel 1
 * (`SceneKey.NARRATIVE` con `{ levelId }` vía `wipeTo`: «la niebla lo cubre
 * todo»).
 *
 * ARQUITECTURA — MÁQUINA DE ACTOS/BEATS (data-first):
 *  - Los pasos viven como DATOS en `INTRO_BEATS` (`config/intro.ts`): array
 *    ordenado `{ id, durationMs, caption }`. La escena entra al beat 0 en
 *    `create()`; cada beat se auto-avanza al agotarse su duración O por tap
 *    en cualquier parte; al completarse el ÚLTIMO beat se cierra hacia
 *    NARRATIVE.
 *  - Cada id tiene su «player» (el bloque de tweens) en el Record
 *    `this.beatPlayers` — EXHAUSTIVO por tipos: añadir un id a `IntroBeatId`
 *    sin su player no compila, y el compilador guía el resto. Para trocar de
 *    fondo entre actos, el player llama
 *    `this.buildBackground(LORE_BACKGROUNDS.alley, true)`.
 *
 * CONTRATO de los players (idempotencia ante taps rápidos):
 *  - `advance()` limpia SIEMPRE el beat vigente antes de entrar al siguiente
 *    (`clearBeatFx`: mata el timer, mata TODOS los tweens y destruye los FX
 *    transitorios registrados en `this.beatFx`).
 *  - Cada player NORMALIZA el estado que necesita (alfa/escala/rotación/
 *    posición de los personajes): no depende de cómo quedó el beat anterior
 *    si un tap lo cortó a medias. Prohibido `delayedCall` propio: los
 *    retardos van dentro de tweens (los sí mata `clearBeatFx`).
 *  - La salida tiene guard propio (`this.exiting`): ni el doble tap ni un
 *    tap + auto-avance simultáneos disparan DOS transiciones (`wipeTo` ya
 *    trae su guard de reentrada; este es el de los saltos entre beats).
 *
 * Fondos: acto 1 — composición del laboratorio (`LORE_BACKGROUNDS.lab` →
 * `LAB_PARALLAX_LAYERS` + props de mesa/frascos con brillo); acto 2 —
 * `LORE_BACKGROUNDS.alley` trocado con velo de noche (callejón estrecho con
 * una única farola). Personajes a depth 8 (la niña 7.8), letrero pergamino +
 * «Saltar» (estilo `NARRATIVE_SKIP_BUTTON`) encima, flash de la transformación
 * y velo de niebla del cierre por encima de todo lo demás de la escena.
 */
import Phaser from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import {
  fogMid,
  fogNear,
  hexToNumber,
  nightBackground,
} from '../config/palette';
import { SceneKey } from '../config/sceneKeys';
import { ParallaxField } from '../art/ParallaxField';
import { lampFlicker } from '../art/parallax';
import { TEXTURE_KEYS } from '../art/textures';
import {
  LORE_BACKGROUNDS,
  NARRATIVE_SKIP_BUTTON,
  type LoreBackgroundDef,
  type LoreStarSlot,
} from '../config/narrative';
import {
  INTRO_ALLEY_WALK,
  INTRO_BEATS,
  INTRO_DRINK,
  INTRO_ENTRANCE,
  INTRO_GIRL_APPEARS,
  INTRO_MENACE,
  INTRO_PLAYER_IS_HYDE,
  INTRO_SCENE_LAYOUT,
  INTRO_TARGET_LEVEL_ID,
  INTRO_TEXTURES,
  INTRO_TRANSFORMATION,
  IntroBeatId,
  nextBeatIndex,
  puffTintFor,
  type IntroBeat,
  type IntroBeatId as IntroBeatIdType,
} from '../config/intro';
import { fadeIn, wipeTo } from './sceneNav';
import { getSystems } from '../systems/getSystems';
import type { AudioSystem } from '../systems/AudioSystem';
import { GothicButton } from '../ui/GothicButton';

/** Prop con brillo pulsante (frascos del laboratorio; igual que NarrativeScene). */
interface GlowingProp {
  sprite: Phaser.GameObjects.Image;
  baseAlpha: number;
  phase: number;
}

export class IntroScene extends Phaser.Scene {
  private audioSystem!: AudioSystem;
  /** Campo parallax del fondo (vapor de laboratorio; callejón en el acto 2). */
  private field: ParallaxField | null = null;
  private backgroundObjects: Phaser.GameObjects.Image[] = [];
  private readonly glowing: GlowingProp[] = [];
  /** Def del fondo VIGENTE (identidad): permite volver al acto 1 con coherencia. */
  private activeBackground: LoreBackgroundDef | null = null;

  private jekyll!: Phaser.GameObjects.Image;
  private hyde!: Phaser.GameObjects.Image;
  /**
   * Brazo delantero ARTICULADO de Hyde (textura `hyde-arm` con el pivote en
   * el hombro): la escena lo pega a Hyde cada frame (`update`) y los beats
   * lo animan con rotación propia — vaivén al caminar, ALZA en el acecho,
   * pose congelada con respiración en el cierre.
   */
  private hydeArm!: Phaser.GameObjects.Image;
  /** La niña (acto 2): oculta hasta el beat «GirlAppears»; farol hacia Hyde. */
  private girl!: Phaser.GameObjects.Image;
  private captionText!: Phaser.GameObjects.Text;

  /** Índice del beat vigente dentro de `INTRO_BEATS`. */
  private beatIndex = 0;
  /** Timer de auto-avance del beat vigente (se retira al saltar). */
  private beatTimer?: Phaser.Time.TimerEvent;
  /** FX transitorios del beat vigente (se destruyen al avanzar/salir). */
  private readonly beatFx: Phaser.GameObjects.GameObject[] = [];
  /** Flechas del costado (adelante/atrás ENTRE BEATS): navegación unificada. */
  private prevArrow!: Phaser.GameObjects.Image;
  private nextArrow!: Phaser.GameObjects.Image;
  /** True cuando ya se disparó la salida hacia NARRATIVE (anti doble tap). */
  private exiting = false;

  /**
   * Players por beat (Record EXHAUSTIVO: añadir un id a `IntroBeatId` sin su
   * player no compila). Cada uno es un bloque de tweens autocontenido.
   */
  private readonly beatPlayers: Readonly<
    Record<IntroBeatIdType, (beat: IntroBeat) => void>
  > = {
    [IntroBeatId.Entrance]: (beat) => this.playEntrance(beat),
    [IntroBeatId.Drink]: (beat) => this.playDrink(beat),
    [IntroBeatId.Transformation]: (beat) => this.playTransformation(beat),
    [IntroBeatId.AlleyWalk]: (beat) => this.playAlleyWalk(beat),
    [IntroBeatId.GirlAppears]: (beat) => this.playGirlAppears(beat),
    [IntroBeatId.Menace]: (beat) => this.playMenace(beat),
    [IntroBeatId.PlayerIsHyde]: (beat) => this.playPlayerIsHyde(beat),
  };

  constructor() {
    super(SceneKey.INTRO);
  }

  create(): void {
    const { audioSystem } = getSystems(this);
    this.audioSystem = audioSystem;

    fadeIn(this);
    this.cameras.main.setBackgroundColor(nightBackground);

    this.beatIndex = 0;
    this.exiting = false;
    this.beatFx.length = 0;

    this.buildBackground(LORE_BACKGROUNDS.lab);
    this.buildCharacters();
    this.buildCaption();
    this.buildSkipButton();
    this.buildNavArrows();
    this.buildTapLayer();

    // Ambiente al entrar (SPEC §8) — solo si un gesto anterior desbloqueó
    // el AudioContext; wind() respeta el mute internamente.
    if (audioSystem.isUnlocked) {
      audioSystem.wind();
    }

    this.enterBeat(0);
  }

  update(time: number): void {
    const t = time / 1000;
    this.field?.update(t);
    for (const prop of this.glowing) {
      prop.sprite.alpha = prop.baseAlpha * lampFlicker(t + prop.phase, 0.72, 1.6);
    }
    this.syncArmToHyde();
  }

  /**
   * El brazo articulado PEGA a Hyde cada frame: pivote (hombro) anclado al
   * offset constante (12, −8) del centro de su textura 144×240 — escalado por
   * el sprite. La posición la manda el cuerpo (tweens de paseo/acecho); la
   * ROTACIÓN es propia de cada beat. Visible solo cuando Hyde lo está.
   */
  private syncArmToHyde(): void {
    this.hydeArm.setVisible(this.hyde.visible);
    if (!this.hydeArm.visible) {
      return;
    }
    const k = INTRO_SCENE_LAYOUT.character.scale;
    this.hydeArm.setPosition(this.hyde.x + 12 * k, this.hyde.y - 8 * k);
  }

  // ---- Fondo (reutilizable: el acto 2 troca al callejón con animated=true) ----

  /**
   * Construye (o troca) el fondo desde una `LoreBackgroundDef` de
   * `config/narrative.ts`. Con `animated`, un velo de noche cubre el cambio
   * y se disipa (el acto 2 lo usa para pasar del laboratorio al callejón).
   * El velo queda a `backgroundVeilDepth` (entre los props y los personajes):
   * los players recolocan/recrean a los personajes por su cuenta.
   */
  private buildBackground(def: LoreBackgroundDef, animated = false): void {
    this.activeBackground = def;
    if (animated) {
      const veil = this.add
        .rectangle(
          BASE_WIDTH / 2,
          BASE_HEIGHT / 2,
          BASE_WIDTH,
          BASE_HEIGHT,
          hexToNumber(nightBackground),
          1,
        )
        .setDepth(INTRO_SCENE_LAYOUT.backgroundVeilDepth);
      this.beatFx.push(veil);
      this.tweens.add({
        targets: veil,
        alpha: 0,
        duration: INTRO_SCENE_LAYOUT.backgroundSwapMs,
        onComplete: () => veil.destroy(),
      });
    }

    for (const obj of this.backgroundObjects) {
      obj.destroy();
    }
    this.backgroundObjects = [];
    this.glowing.length = 0;
    this.field?.destroy();

    this.field = new ParallaxField(this, {
      layers: def.layers,
      ground: def.ground ? { color: def.ground.color, y: def.ground.y } : undefined,
    });

    // Props estáticos (mesa + frascos) con brillo pulsante como en narrativa.
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

    // Estrellas del cielo (solo el callejón del acto 2): detrás de las
    // siluetas (capas ≥ 1) y titilando con fases propias, como en narrativa.
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

  /**
   * Garantiza que el fondo VIGENTE sea el pedido: si ya lo es, no toca nada
   * (volver con la flecha «atrás» de un acto al otro no debe reconstruir ni
   * parpadear); si no, lo troca — con velo si el cambio es teatral.
   */
  private ensureBackground(def: LoreBackgroundDef, animated = false): void {
    if (this.activeBackground !== def) {
      this.buildBackground(def, animated);
    }
  }

  // ---- Actores fijos de la escena --------------------------------------------

  private buildCharacters(): void {
    const { character, girl } = INTRO_SCENE_LAYOUT;
    // Jekyll entra invisible (el beat «Entrance» lo trae a escena).
    this.jekyll = this.add
      .image(character.x, character.y, INTRO_TEXTURES.jekyll)
      .setScale(character.scale)
      .setDepth(character.depth)
      .setAlpha(0);
    // Hyde permanece oculto hasta el crossfade de la transformación.
    this.hyde = this.add
      .image(character.x, character.y, INTRO_TEXTURES.hyde)
      .setScale(character.scale)
      .setDepth(character.depth)
      .setAlpha(0)
      .setVisible(false);
    // El brazo articulado: pivote en el hombro (36,16) de la textura 72×128,
    // delante del cuerpo, y oculto hasta que Hyde se transforma.
    this.hydeArm = this.add
      .image(character.x, character.y, INTRO_TEXTURES.arm)
      .setOrigin(0.5, 0.125)
      .setScale(character.scale)
      .setDepth(character.depth + 0.5)
      .setAlpha(0)
      .setVisible(false);
    // La niña (acto 2): oculta hasta «GirlAppears»; flipX para que su farol
    // (lado derecho de la textura) quede del lado de Hyde.
    this.girl = this.add
      .image(girl.x, girl.y, INTRO_TEXTURES.girl)
      .setScale(girl.scale)
      .setFlipX(true)
      .setDepth(girl.depth)
      .setAlpha(0)
      .setVisible(false);
  }

  /** Letrero pergamino inferior (texto Crimson Text, SPEC §7.3). */
  private buildCaption(): void {
    const { caption } = INTRO_SCENE_LAYOUT;
    this.add
      .image(caption.x, caption.y, INTRO_TEXTURES.captionPanel)
      .setDisplaySize(caption.panelWidth, caption.panelHeight)
      .setDepth(caption.depth);
    this.captionText = this.add
      .text(caption.x, caption.y, '', {
        fontFamily: caption.style.fontFamily,
        fontSize: `${caption.style.fontSize}px`,
        color: caption.style.color,
        wordWrap: { width: caption.style.wordWrapWidth },
      })
      .setOrigin(0.5)
      .setDepth(caption.depth + 0.5)
      .setLineSpacing(caption.lineSpacing)
      .setAlpha(0);
  }

  /** Muestra un letrero con fade ('' = mantener el vigente, sin re-fade). */
  private showCaption(text: string): void {
    if (text.length === 0) {
      return;
    }
    this.tweens.killTweensOf(this.captionText);
    this.captionText.setText(text);
    this.tweens.add({
      targets: this.captionText,
      alpha: 1,
      duration: INTRO_SCENE_LAYOUT.caption.fadeMs,
      ease: 'Sine.easeInOut',
    });
  }

  private buildSkipButton(): void {
    const { skipButton } = INTRO_SCENE_LAYOUT;
    new GothicButton(this, skipButton.x, skipButton.y, {
      label: NARRATIVE_SKIP_BUTTON.label,
      layout: NARRATIVE_SKIP_BUTTON.layout,
      onPress: (): void => this.onSkip(),
    }).setDepth(skipButton.depth);
  }

  // ---- Flechas del costado (adelante/atrás entre beats) -----------------------

  /**
   * MISMA navegación que la narrativa: flecha a cada costado para pasar de
   * beat, «atrás» atenuada en el primero. Van más arriba que en la narrativa
   * (`INTRO_SCENE_LAYOUT.nav.y`) para no pisar a los personajes. El auto-
   * avance por tiempo y el tap en cualquier parte siguen funcionando.
   */
  private buildNavArrows(): void {
    const { nav } = INTRO_SCENE_LAYOUT;
    const hit = 100;
    const half = hit / 2;

    this.prevArrow = this.add
      .image(nav.marginX, nav.y, TEXTURE_KEYS.arrow)
      .setScale(nav.scale)
      .setFlipX(true)
      .setDepth(nav.depth)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-half, -half, hit, hit),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      })
      .on(Phaser.Input.Events.POINTER_DOWN, () => this.onNavBack());

    this.nextArrow = this.add
      .image(BASE_WIDTH - nav.marginX, nav.y, TEXTURE_KEYS.arrow)
      .setScale(nav.scale)
      .setDepth(nav.depth)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-half, -half, hit, hit),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      })
      .on(Phaser.Input.Events.POINTER_DOWN, () => this.onNavForward());

    this.updateNavArrows();
  }

  /** Estado de las flechas: «atrás» se atenúa en el primer beat. */
  private updateNavArrows(): void {
    const { nav } = INTRO_SCENE_LAYOUT;
    const canGoBack = this.beatIndex > 0 && !this.exiting;
    this.prevArrow.setAlpha(canGoBack ? 1 : nav.disabledAlpha);
    this.nextArrow.setAlpha(this.exiting ? nav.disabledAlpha : 1);
  }

  /** Feedback táctil del press (se restituye solo, como en la narrativa). */
  private pressFeedback(arrow: Phaser.GameObjects.Image): void {
    const { nav } = INTRO_SCENE_LAYOUT;
    this.tweens.killTweensOf(arrow);
    this.tweens.add({
      targets: arrow,
      scale: { from: nav.scale * nav.pressedScale, to: nav.scale },
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  /** Flecha «atrás»: re-entra al beat anterior (los players normalizan todo). */
  private onNavBack(): void {
    if (this.exiting || this.beatIndex <= 0) {
      return;
    }
    this.audioSystem.blip();
    this.pressFeedback(this.prevArrow);
    this.clearBeatFx();
    this.enterBeat(this.beatIndex - 1);
  }

  /** Flecha «adelante»: la MISMA semántica que el tap (en el último, cierra). */
  private onNavForward(): void {
    if (this.exiting) {
      return;
    }
    this.pressFeedback(this.nextArrow);
    this.onTap();
  }

  /** Capa de tap bajo toda la UI: cualquier punto de la pantalla avanza. */
  private buildTapLayer(): void {
    this.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x000000, 0)
      .setDepth(-1)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(
          -BASE_WIDTH / 2,
          -BASE_HEIGHT / 2,
          BASE_WIDTH,
          BASE_HEIGHT,
        ),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      })
      .on(Phaser.Input.Events.POINTER_DOWN, () => this.onTap());
  }

  // ---- Máquina de beats --------------------------------------------------------

  private enterBeat(index: number): void {
    this.beatIndex = index;
    const beat = INTRO_BEATS[index];
    this.beatPlayers[beat.id](beat);
    // Auto-avance al agotarse la duración del beat (el tap lo adelanta).
    this.beatTimer = this.time.delayedCall(beat.durationMs, () => this.advance());
    this.updateNavArrows();
  }

  /**
   * Guard anti taps rápidos entre beats: retira el timer y TODO tween/FX del
   * beat vigente antes de entrar al siguiente. Los players normalizan su
   * estado de partida, así que nada «medio animado» contamina el nuevo beat.
   */
  private clearBeatFx(): void {
    this.beatTimer?.remove(false);
    this.beatTimer = undefined;
    this.tweens.killAll();
    for (const fx of this.beatFx) {
      fx.destroy();
    }
    this.beatFx.length = 0;
    // El letrero no compite con tweens muertos: si ya tiene texto, se ve.
    this.captionText.setAlpha(this.captionText.text.length > 0 ? 1 : 0);
  }

  /** Tap en cualquier parte: avanza al siguiente beat (o cierra la intro). */
  private onTap(): void {
    if (this.exiting) {
      return;
    }
    this.audioSystem.blip();
    this.advance();
  }

  private advance(): void {
    if (this.exiting) {
      return;
    }
    this.clearBeatFx();
    const next = nextBeatIndex(this.beatIndex);
    if (next < 0) {
      // Último beat completado: la niebla lo cubre todo → narrativa del N1.
      this.exitToNarrative();
      return;
    }
    this.enterBeat(next);
  }

  private onSkip(): void {
    if (this.exiting) {
      return;
    }
    this.audioSystem.blip();
    this.exitToNarrative();
  }

  /** Cierre ÚNICO de la intro (guard de reentrada propio + el de `wipeTo`). */
  private exitToNarrative(): void {
    if (this.exiting) {
      return;
    }
    this.exiting = true;
    this.updateNavArrows();
    this.clearBeatFx();
    // Sweep de viento de la transición (SPEC §8), si el audio ya está desbloqueado.
    if (this.audioSystem.isUnlocked) {
      this.audioSystem.wind(1.6);
    }
    // `fromIntro`: la narrativa arranca en el primer panel que la cinemática
    // NO contó (los 1–3 ya se vieron animados — no se lee la historia dos veces).
    wipeTo(this, SceneKey.NARRATIVE, { levelId: INTRO_TARGET_LEVEL_ID, fromIntro: true });
  }

  // ---- Beat 1 — ENTRANCE: Jekyll aparece en su laboratorio --------------------

  private playEntrance(beat: IntroBeat): void {
    const { character } = INTRO_SCENE_LAYOUT;
    // Normaliza (un tap o la flecha «atrás» pudo cortar el beat anterior o
    // este mismo). Volver desde el acto 2 restituye el laboratorio.
    this.ensureBackground(LORE_BACKGROUNDS.lab, true);
    this.jekyll
      .setVisible(true)
      .setPosition(character.x, character.y)
      .setRotation(0)
      .setScale(character.scale * INTRO_ENTRANCE.scaleFrom)
      .setAlpha(0);
    this.hyde.setVisible(false).setAlpha(0).setPosition(character.x, character.y);

    // Entrada suave: fade + pop de escala (Back.easeOut).
    this.tweens.add({
      targets: this.jekyll,
      alpha: { from: 0, to: 1 },
      duration: INTRO_ENTRANCE.fadeMs,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.jekyll,
      scale: { from: character.scale * INTRO_ENTRANCE.scaleFrom, to: character.scale },
      duration: INTRO_ENTRANCE.fadeMs + 200,
      ease: 'Back.easeOut',
    });
    // Respiración sutil mientras dura el beat (muere con clearBeatFx).
    this.tweens.add({
      targets: this.jekyll,
      y: character.y - 6,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.showCaption(beat.caption);
  }

  // ---- Beat 2 — DRINK: levanta el frasco, bebe, pausa dramática ---------------

  private playDrink(beat: IntroBeat): void {
    const { character } = INTRO_SCENE_LAYOUT;
    this.ensureBackground(LORE_BACKGROUNDS.lab, true);
    this.jekyll
      .setVisible(true)
      .setPosition(character.x, character.y)
      .setRotation(0)
      .setScale(character.scale)
      .setAlpha(1);
    this.hyde.setVisible(false).setAlpha(0);

    // 1) Levanta el frasco: rotación antihoraria (el lado del frasco sube).
    this.tweens.add({
      targets: this.jekyll,
      rotation: { from: 0, to: INTRO_DRINK.tiltRad },
      duration: INTRO_DRINK.tiltMs,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // 2) El trago: un puff verde asciende del frasco a la boca…
        this.spawnGulp();
        // 3) …y vuelve a la posición recta; queda la pausa dramática.
        this.tweens.add({
          targets: this.jekyll,
          rotation: { from: INTRO_DRINK.tiltRad, to: 0 },
          delay: INTRO_DRINK.holdMs,
          duration: INTRO_DRINK.returnMs,
          ease: 'Sine.easeInOut',
        });
      },
    });

    this.showCaption(beat.caption); // '' → mantiene el letrero de la entrada
  }

  /**
   * El trago: mini-puff de niebla teñido de verde que sube del matraz a la
   * boca. Posiciones relativas a la textura `jekyll` (128×224): el matraz
   * vive en (100, 47) y la boca en (64, 58) — escaladas por el sprite.
   */
  private spawnGulp(): void {
    const { character } = INTRO_SCENE_LAYOUT;
    const k = character.scale;
    const gulp = this.add
      .image(character.x + 36 * k, character.y - 65 * k, INTRO_TEXTURES.puff)
      .setScale(INTRO_DRINK.gulp.scale)
      .setTint(hexToNumber(INTRO_DRINK.gulp.color))
      .setDepth(character.depth + 1);
    this.beatFx.push(gulp);
    this.tweens.add({
      targets: gulp,
      x: character.x,
      y: character.y - 54 * k,
      alpha: { from: 0.9, to: 0 },
      scale: { from: INTRO_DRINK.gulp.scale, to: INTRO_DRINK.gulp.scale * 0.5 },
      duration: INTRO_DRINK.gulp.durationMs,
      ease: 'Sine.easeOut',
    });
  }

  // ---- Beat 3 — TRANSFORMATION: flash, sacudida, niebla y crossfade ------------

  private playTransformation(beat: IntroBeat): void {
    const { character, flashDepth } = INTRO_SCENE_LAYOUT;
    const T = INTRO_TRANSFORMATION;

    // Normaliza: Jekyll entero en el centro, Hyde esperando invisible. Si se
    // volvió atrás desde el callejón, el laboratorio vuelve a escena.
    this.ensureBackground(LORE_BACKGROUNDS.lab, true);
    this.jekyll
      .setVisible(true)
      .setPosition(character.x, character.y)
      .setRotation(0)
      .setScale(character.scale)
      .setAlpha(1);
    this.hyde
      .setVisible(true)
      .setPosition(character.x, character.y)
      .setScale(character.scale * T.pop.fromFactor)
      .setAlpha(0);
    // El brazo nace con Hyde: mismo retardo y duración que el crossfade.
    this.hydeArm.setVisible(true).setRotation(0).setAlpha(0);

    // Golpe dramático (thump respeta mute/desbloqueo internamente).
    this.audioSystem.thump();

    // 1) Flash verde fullscreen: sube al pico y baja (yoyo).
    const flash = this.add
      .rectangle(
        BASE_WIDTH / 2,
        BASE_HEIGHT / 2,
        BASE_WIDTH,
        BASE_HEIGHT,
        hexToNumber(T.flash.color),
        0,
      )
      .setDepth(flashDepth);
    this.beatFx.push(flash);
    this.tweens.add({
      targets: flash,
      alpha: { from: 0, to: T.flash.peakAlpha },
      duration: T.flash.durationMs / 2,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });

    // 2) Sacudida de cámara + temblor del sprite (el cuerpo rechaza la fórmula).
    this.cameras.main.shake(T.shake.durationMs, T.shake.intensity);
    this.tweens.add({
      targets: this.jekyll,
      x: character.x + T.tremble.amplitudePx,
      duration: T.tremble.durationMs,
      yoyo: true,
      repeat: T.tremble.repeats,
      ease: 'Sine.easeInOut',
    });

    // 3) Puffs de niebla teñida estallando alrededor del personaje.
    this.spawnTransformationPuffs();

    // 4) Crossfade en espejo Jekyll → Hyde…
    this.tweens.add({
      targets: this.jekyll,
      alpha: { from: 1, to: 0 },
      delay: T.crossfadeDelayMs,
      duration: T.crossfadeMs,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.hyde,
      alpha: { from: 0, to: 1 },
      delay: T.crossfadeDelayMs,
      duration: T.crossfadeMs,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // 5) …pop de escala al revelar + halo púrpura que se disipa.
        this.tweens.add({
          targets: this.hyde,
          scale: { from: character.scale * T.pop.fromFactor, to: character.scale },
          duration: T.pop.durationMs,
          ease: 'Back.easeOut',
        });
        this.spawnHalo();
      },
    });

    this.showCaption(beat.caption);
  }

  /** Anillo DETERMINISTA de puffs alrededor del personaje (ángulos fijos). */
  private spawnTransformationPuffs(): void {
    const { character } = INTRO_SCENE_LAYOUT;
    const puffs = INTRO_TRANSFORMATION.puffs;
    for (let i = 0; i < puffs.count; i++) {
      const angle = (Math.PI * 2 * i) / puffs.count + Math.PI / puffs.count;
      const puff = this.add
        .image(
          character.x + Math.cos(angle) * puffs.radiusPx,
          character.y + Math.sin(angle) * puffs.radiusPx * 0.7,
          INTRO_TEXTURES.puff,
        )
        .setScale(puffs.scale * 0.5)
        .setAlpha(0.85)
        .setTint(hexToNumber(puffTintFor(i)))
        .setDepth(character.depth + 1);
      this.beatFx.push(puff);
      this.tweens.add({
        targets: puff,
        scale: { from: puffs.scale * 0.5, to: puffs.scale },
        alpha: { from: 0.85, to: 0 },
        delay: i * puffs.staggerMs,
        duration: puffs.durationMs,
        ease: 'Sine.easeOut',
      });
    }
  }

  /** Halo púrpura que rodea a Hyde al materializarse y se disipa. */
  private spawnHalo(): void {
    const { character } = INTRO_SCENE_LAYOUT;
    const halo = INTRO_TRANSFORMATION.halo;
    const sprite = this.add
      .image(character.x, character.y, INTRO_TEXTURES.halo)
      .setScale(halo.fromScale)
      .setAlpha(halo.startAlpha)
      .setTint(hexToNumber(halo.color))
      .setDepth(character.depth + 1);
    this.beatFx.push(sprite);
    this.tweens.add({
      targets: sprite,
      scale: { from: halo.fromScale, to: halo.toScale },
      alpha: { from: halo.startAlpha, to: 0 },
      duration: halo.durationMs,
      ease: 'Sine.easeOut',
    });
  }

  // ---- Beat 4 — ALLEY WALK: troca al callejón y Hyde lo cruza -----------------

  private playAlleyWalk(beat: IntroBeat): void {
    const { character } = INTRO_SCENE_LAYOUT;
    const W = INTRO_ALLEY_WALK;

    // Troca al callejón con velo de noche (solo si el fondo vigente no lo es:
    // re-entrar al beat con las flechas no debe reconstruir el fondo).
    this.ensureBackground(LORE_BACKGROUNDS.alley, true);

    // Normaliza: Jekyll fuera de escena, niña aún oculta y Hyde ENTRANDO por
    // la IZQUIERDA (la textura mira a la derecha: no hay que voltearlo). El
    // salto de posición del crossfade queda tapado: emerge de la niebla con
    // un fade-in encima del velo del trocado. El brazo articulado entra con él.
    this.jekyll.setVisible(false).setAlpha(0);
    this.girl.setVisible(false).setAlpha(0);
    this.hyde
      .setVisible(true)
      .setPosition(W.fromX, character.y)
      .setRotation(0)
      .setScale(character.scale)
      .setAlpha(0);
    this.hydeArm.setVisible(true).setRotation(0).setAlpha(0);

    // Cruza caminando (la deriva del fondo acompaña el paseo)…
    this.tweens.add({
      targets: this.hyde,
      x: { from: W.fromX, to: W.toX },
      duration: W.walkMs,
      ease: 'Sine.easeInOut',
    });
    // …emerge de la niebla mientras el velo del fondo se disipa.
    this.tweens.add({
      targets: this.hyde,
      alpha: { from: 0, to: 1 },
      duration: W.emergeMs,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: this.hydeArm,
      alpha: { from: 0, to: 1 },
      duration: W.emergeMs,
      ease: 'Sine.easeOut',
    });
    // Vaivén del paso: bob vertical + balanceo mínimo (muere con clearBeatFx).
    this.tweens.add({
      targets: this.hyde,
      y: character.y - W.bob.px,
      duration: W.bob.cycleMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.hyde,
      rotation: { from: W.rockRad, to: -W.rockRad },
      duration: W.bob.cycleMs * 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // El brazo articulado acompaña el paso: oscila desde el hombro con el
    // MISMO ciclo del bob — el caminar se lee en todo el cuerpo.
    this.tweens.add({
      targets: this.hydeArm,
      rotation: { from: W.arm.swayRad, to: -W.arm.swayRad },
      duration: W.arm.cycleMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.showCaption(beat.caption);
  }

  // ---- Beat 5 — GIRL APPEARS: la niña entra a su esquina con su farol ---------

  private playGirlAppears(beat: IntroBeat): void {
    const { character, girl } = INTRO_SCENE_LAYOUT;
    const G = INTRO_GIRL_APPEARS;

    // Normaliza: Hyde detenido donde lo dejó el paseo; la niña entra por la
    // DERECHA con el farol hacia Hyde (flipX).
    this.jekyll.setVisible(false).setAlpha(0);
    this.hyde
      .setVisible(true)
      .setPosition(INTRO_ALLEY_WALK.toX, character.y)
      .setRotation(0)
      .setScale(character.scale)
      .setAlpha(1);
    this.hydeArm.setVisible(true).setAlpha(1);
    this.girl
      .setVisible(true)
      .setPosition(G.fromX, girl.y)
      .setRotation(0)
      .setScale(girl.scale)
      .setFlipX(true)
      .setAlpha(1);

    // Entra desde la esquina y se detiene (llega frenando, Sine.easeOut).
    this.tweens.add({
      targets: this.girl,
      x: { from: G.fromX, to: girl.x },
      duration: G.enterMs,
      ease: 'Sine.easeOut',
    });
    // Al detenerse, el farol tiembla: vaivén sutil de rotación (repeat -1).
    this.tweens.add({
      targets: this.girl,
      rotation: { from: -G.tremble.rad, to: G.tremble.rad },
      delay: G.enterMs,
      duration: G.tremble.cycleMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // El brazo de Hyde cuelga quieto pero VIVO: una respiración mínima.
    this.tweens.add({
      targets: this.hydeArm,
      rotation: { from: 0.05, to: -0.05 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.spawnLanternGlow();

    this.showCaption(beat.caption);
  }

  /**
   * Resplandor del farol de la niña: un puff teñido de fuego que respira
   * DETRÁS de la lámpara. Nace acompañando la entrada (mismo tween de x que
   * ella) y enciende a partir de la detención — todo con tweens (los
   * `delayedCall` propios están prohibidos: `clearBeatFx` no los ve).
   */
  private spawnLanternGlow(): void {
    const { girl } = INTRO_SCENE_LAYOUT;
    const G = INTRO_GIRL_APPEARS;
    // El farol vive en (72, 92) de la textura 96×176; con flipX queda a la
    // IZQUIERDA del centro (del lado de Hyde).
    const offsetX = -(72 - 96 / 2) * girl.scale;
    const offsetY = (92 - 176 / 2) * girl.scale;
    const glow = this.add
      .image(G.fromX + offsetX, girl.y + offsetY, INTRO_TEXTURES.puff)
      .setScale(G.glow.scale)
      .setAlpha(0)
      .setTint(hexToNumber(G.glow.color))
      .setDepth(girl.depth - 0.1);
    this.beatFx.push(glow);
    this.tweens.add({
      targets: glow,
      x: { from: G.fromX + offsetX, to: girl.x + offsetX },
      duration: G.enterMs,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: glow,
      alpha: { from: 0, to: G.glow.alpha },
      delay: G.enterMs,
      duration: G.glow.breatheMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ---- Beat 6 — MENACE: Hyde la ve, acecha y ALZA EL BRAZO (sin contacto) -----

  private playMenace(beat: IntroBeat): void {
    const { character, girl } = INTRO_SCENE_LAYOUT;
    const M = INTRO_MENACE;
    // El acecho arranca cuando el destello del ojo completa su yoyo (2 tramos).
    const lungeDelayMs = M.seeDelayMs + M.eyeFlare.durationMs * 2;

    // Normaliza: Hyde al inicio del acecho (brazo articulado incluido); la
    // niña en su esquina, entera.
    this.jekyll.setVisible(false).setAlpha(0);
    this.hyde
      .setVisible(true)
      .setPosition(INTRO_ALLEY_WALK.toX, character.y)
      .setRotation(0)
      .setScale(character.scale)
      .setAlpha(1);
    this.hydeArm.setVisible(true).setAlpha(1).setRotation(0);
    this.girl
      .setVisible(true)
      .setPosition(girl.x, girl.y)
      .setRotation(0)
      .setScale(girl.scale)
      .setFlipX(true)
      .setAlpha(1);

    // 1) Pausa: LA VE (destello verde del ojo, como el gulp del frasco).
    this.spawnEyeFlare();

    // 2) Avanza acechando (acelera, Quad.easeIn) pero SIN alcanzarla…
    this.tweens.add({
      targets: this.hyde,
      x: { from: INTRO_ALLEY_WALK.toX, to: M.lunge.toX },
      delay: lungeDelayMs,
      duration: M.lunge.durationMs,
      ease: 'Quad.easeIn',
    });
    //    …y el torso se ENCORVA hacia adelante mientras acecha.
    this.tweens.add({
      targets: this.hyde,
      rotation: { from: 0, to: M.hunchRad },
      delay: lungeDelayMs,
      duration: M.lunge.durationMs,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // 3) …y ALZA EL BRAZO: el brazo ARTICULADO gira desde el hombro con
        //    Back.easeOut (latigazo con overshoot) y queda EN ALTO apuntando
        //    a la niña. El golpe NUNCA cae.
        this.tweens.add({
          targets: this.hydeArm,
          rotation: { from: 0, to: M.armRaise.rad },
          duration: M.armRaise.durationMs,
          ease: 'Back.easeOut',
        });
      },
    });
    this.spawnMenacePuffs(lungeDelayMs);

    // 4) La niña se encoge: retroceso corto + hacerse pequeña (temblor).
    //    Jamás hay contacto — queda «asustada pero ilesa» (lore del quiz).
    this.tweens.add({
      targets: this.girl,
      x: { from: girl.x, to: M.flinch.toX },
      delay: lungeDelayMs + M.flinch.delayMs,
      duration: M.flinch.durationMs,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: this.girl,
      scaleY: girl.scale * M.tremble.scaleY,
      delay: lungeDelayMs + M.flinch.delayMs + M.flinch.durationMs,
      duration: M.tremble.cycleMs,
      yoyo: true,
      repeat: M.tremble.repeats,
      ease: 'Sine.easeInOut',
    });

    this.showCaption(beat.caption);
  }

  /** Destello verde del ojo de Hyde («la ve»): un puff que sube y baja. */
  private spawnEyeFlare(): void {
    const { character } = INTRO_SCENE_LAYOUT;
    const M = INTRO_MENACE;
    // El ojo vive en (106, 88) de la textura 144×240 — escalado por el sprite.
    const k = character.scale;
    const flare = this.add
      .image(
        INTRO_ALLEY_WALK.toX + (106 - 144 / 2) * k,
        character.y + (88 - 240 / 2) * k,
        INTRO_TEXTURES.puff,
      )
      .setScale(M.eyeFlare.scale)
      .setAlpha(0)
      .setTint(hexToNumber(M.eyeFlare.color))
      .setDepth(character.depth + 1);
    this.beatFx.push(flare);
    this.tweens.add({
      targets: flare,
      alpha: { from: 0, to: 0.85 },
      scale: { from: M.eyeFlare.scale * 0.5, to: M.eyeFlare.scale },
      delay: M.seeDelayMs,
      duration: M.eyeFlare.durationMs,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  /** Puffs de niebla que levanta el acecho, tras los pies de Hyde. */
  private spawnMenacePuffs(lungeDelayMs: number): void {
    const { character } = INTRO_SCENE_LAYOUT;
    const M = INTRO_MENACE;
    for (let i = 0; i < M.puffs.count; i++) {
      const puff = this.add
        .image(
          INTRO_ALLEY_WALK.toX - 70 + i * 60,
          character.y + (240 / 2) * character.scale - 24,
          INTRO_TEXTURES.puff,
        )
        .setScale(M.puffs.scale * 0.5)
        .setAlpha(0)
        .setTint(hexToNumber(fogMid))
        .setDepth(character.depth - 0.1);
      this.beatFx.push(puff);
      this.tweens.add({
        targets: puff,
        scale: { from: M.puffs.scale * 0.5, to: M.puffs.scale },
        alpha: { from: 0.45, to: 0 },
        delay: lungeDelayMs + i * M.puffs.staggerMs,
        duration: M.puffs.durationMs,
        ease: 'Sine.easeOut',
      });
    }
  }

  // ---- Beat 7 — PLAYER IS HYDE: la niebla crece y el letrero nos señala -------

  private playPlayerIsHyde(beat: IntroBeat): void {
    const { character, girl } = INTRO_SCENE_LAYOUT;
    const C = INTRO_PLAYER_IS_HYDE;

    // Normaliza: Hyde con el BRAZO ARTICULADO EN ALTO (pose congelada: el
    // golpe nunca cae), el torso encorvado del acecho; la niña encogida en su
    // esquina; Jekyll fuera de escena.
    this.jekyll.setVisible(false).setAlpha(0);
    this.hyde
      .setVisible(true)
      .setPosition(INTRO_MENACE.lunge.toX, character.y)
      .setRotation(INTRO_MENACE.hunchRad)
      .setScale(character.scale)
      .setAlpha(1);
    this.hydeArm.setVisible(true).setAlpha(1).setRotation(C.armHoldRad);
    this.girl
      .setVisible(true)
      .setPosition(INTRO_MENACE.flinch.toX, girl.y)
      .setRotation(0)
      .setScale(girl.scale)
      .setFlipX(true)
      .setAlpha(1);

    // La niña sigue haciéndose pequeña (respiración angustiada, repeat -1).
    this.tweens.add({
      targets: this.girl,
      scaleY: girl.scale * INTRO_MENACE.tremble.scaleY,
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // El brazo en alto sigue VIVO: una respiración mínica alrededor de la pose.
    this.tweens.add({
      targets: this.hydeArm,
      rotation: { from: C.armHoldRad, to: C.armHoldRad + C.armBreatheRad },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // La niebla crece; al completarse este beat, el flujo existente cierra
    // con el wipe hacia NARRATIVE (el ÚLTIMO beat dispara el cierre).
    this.spawnClosingFog();

    this.showCaption(beat.caption);
  }

  /** Cierre atmosférico: velo de niebla creciente + puffs por toda la escena. */
  private spawnClosingFog(): void {
    const C = INTRO_PLAYER_IS_HYDE;
    const { closingVeilDepth } = INTRO_SCENE_LAYOUT;
    const veil = this.add
      .rectangle(
        BASE_WIDTH / 2,
        BASE_HEIGHT / 2,
        BASE_WIDTH,
        BASE_HEIGHT,
        hexToNumber(C.veil.color),
        0,
      )
      .setDepth(closingVeilDepth);
    this.beatFx.push(veil);
    this.tweens.add({
      targets: veil,
      alpha: { from: 0, to: C.veil.alpha },
      duration: C.veil.durationMs,
      ease: 'Sine.easeInOut',
    });
    for (let i = 0; i < C.puffs.count; i++) {
      // Reparto determinista por el ancho (5 puffs: 0.17, 0.33, 0.5, 0.67, 0.83).
      const fx = (i + 1) / (C.puffs.count + 1);
      const puff = this.add
        .image(
          BASE_WIDTH * fx,
          BASE_HEIGHT * (0.62 + (i % 2) * 0.1),
          INTRO_TEXTURES.puff,
        )
        .setScale(C.puffs.scale * 0.5)
        .setAlpha(0)
        .setTint(hexToNumber(i % 2 === 0 ? fogNear : fogMid))
        .setDepth(closingVeilDepth + 0.5);
      this.beatFx.push(puff);
      this.tweens.add({
        targets: puff,
        scale: { from: C.puffs.scale * 0.5, to: C.puffs.scale },
        alpha: { from: 0.5, to: 0 },
        y: puff.y - 46,
        delay: i * C.puffs.staggerMs,
        duration: C.puffs.durationMs,
        ease: 'Sine.easeOut',
      });
    }
  }
}
