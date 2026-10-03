/**
 * INTRO (cinemática pre-nivel, PLAN fase 1/3): acto 1 — el laboratorio del
 * Dr. Jekyll. Aparece el doctor, bebe su fórmula y se transforma —con
 * animación— en Mr. Hyde; al terminar (o saltar) se pasa a la narrativa del
 * nivel 1 (`SceneKey.NARRATIVE` con `{ levelId }` vía `wipeTo`: «la niebla
 * lo cubre todo»).
 *
 * ARQUITECTURA — MÁQUINA DE ACTOS/BEATS (data-first):
 *  - Los pasos viven como DATOS en `INTRO_BEATS` (`config/intro.ts`): array
 *    ordenado `{ id, durationMs, caption }`. La escena entra al beat 0 en
 *    `create()`; cada beat se auto-avanza al agotarse su duración O por tap
 *    en cualquier parte; al completarse el ÚLTIMO beat se cierra hacia
 *    NARRATIVE.
 *  - Cada id tiene su «player» (el bloque de tweens) en el Record
 *    `this.beatPlayers` — EXHAUSTIVO por tipo: la fase 2 (acto del callejón:
 *    Hyde ve a la niña) añade ids a `IntroBeatId` + entradas a `INTRO_BEATS`
 *    + su player aquí, y el compilador guía el resto. Para trocar de fondo
 *    entre actos, el player llama `this.buildBackground(LORE_BACKGROUNDS.alley, true)`.
 *
 * CONTRATO de los players (idempotencia ante taps rápidos):
 *  - `advance()` limpia SIEMPRE el beat vigente antes de entrar al siguiente
 *    (`clearBeatFx`: mata el timer, mata TODOS los tweens y destruye los FX
 *    transitorios registrados en `this.beatFx`).
 *  - Cada player NORMALIZA el estado que necesita (alfa/escala/rotación/
 *    posición de los personajes): no depende de cómo quedó el beat anterior
 *    si un tap lo cortó a medias.
 *  - La salida tiene guard propio (`this.exiting`): ni el doble tap ni un
 *    tap + auto-avance simultáneos disparan DOS transiciones (`wipeTo` ya
 *    trae su guard de reentrada; este es el de los saltos entre beats).
 *
 * Fondo: composición existente del laboratorio (`LORE_BACKGROUNDS.lab` →
 * `LAB_PARALLAX_LAYERS` + props de mesa/frascos con brillo), personajes a
 * depth 8, letrero pergamino + «Saltar» (estilo `NARRATIVE_SKIP_BUTTON`)
 * encima, flash de la transformación por encima de todo.
 */
import Phaser from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { hexToNumber, nightBackground } from '../config/palette';
import { SceneKey } from '../config/sceneKeys';
import { ParallaxField } from '../art/ParallaxField';
import { lampFlicker } from '../art/parallax';
import {
  LORE_BACKGROUNDS,
  NARRATIVE_SKIP_BUTTON,
  type LoreBackgroundDef,
} from '../config/narrative';
import {
  INTRO_BEATS,
  INTRO_DRINK,
  INTRO_ENTRANCE,
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
  /** Campo parallax del fondo (vapor de laboratorio; callejón en la fase 2). */
  private field: ParallaxField | null = null;
  private backgroundObjects: Phaser.GameObjects.Image[] = [];
  private readonly glowing: GlowingProp[] = [];

  private jekyll!: Phaser.GameObjects.Image;
  private hyde!: Phaser.GameObjects.Image;
  private captionText!: Phaser.GameObjects.Text;

  /** Índice del beat vigente dentro de `INTRO_BEATS`. */
  private beatIndex = 0;
  /** Timer de auto-avance del beat vigente (se retira al saltar). */
  private beatTimer?: Phaser.Time.TimerEvent;
  /** FX transitorios del beat vigente (se destruyen al avanzar/salir). */
  private readonly beatFx: Phaser.GameObjects.GameObject[] = [];
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
  }

  // ---- Fondo (reutilizable: la fase 2 troca al callejón con animated=true) ----

  /**
   * Construye (o troca) el fondo desde una `LoreBackgroundDef` de
   * `config/narrative.ts`. Con `animated`, un velo de noche cubre el cambio
   * y se disipa. El velo queda a `backgroundVeilDepth` (entre los props y los
   * personajes): los players recolocan/recrean a los personajes por su cuenta.
   */
  private buildBackground(def: LoreBackgroundDef, animated = false): void {
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
  }

  // ---- Actores fijos de la escena --------------------------------------------

  private buildCharacters(): void {
    const { character } = INTRO_SCENE_LAYOUT;
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
    this.clearBeatFx();
    // Sweep de viento de la transición (SPEC §8), si el audio ya está desbloqueado.
    if (this.audioSystem.isUnlocked) {
      this.audioSystem.wind(1.6);
    }
    wipeTo(this, SceneKey.NARRATIVE, { levelId: INTRO_TARGET_LEVEL_ID });
  }

  // ---- Beat 1 — ENTRANCE: Jekyll aparece en su laboratorio --------------------

  private playEntrance(beat: IntroBeat): void {
    const { character } = INTRO_SCENE_LAYOUT;
    // Normaliza (un tap pudo cortar el beat anterior o este mismo).
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

    // Normaliza: Jekyll entero en el centro, Hyde esperando invisible.
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
}
