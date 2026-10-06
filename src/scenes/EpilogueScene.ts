/**
 * EPÍLOGO (Fase 4 — cierre de la obra, comic p. 63). Se ve SOLO al ganar el
 * NIVEL 3 (victoria final): Utterson, de noche, en su estudio termina de
 * leer la confesión del doctor; la niebla se cuela en el cuarto y la cara
 * GIGANTE de Hyde emerge de las sombras DETRÁS de él — amenaza SUGERIDA,
 * público 10+ (mismo criterio del acto 2 de la intro): Hyde queda SIEMPRE
 * DETRÁS (depth menor), sin brazo, sin contacto y sin acercarse — solo
 * crece y se alza. Cierra con la cartela del comic («Nadie sabrá nunca el
 * secreto…») + un pulso de flash tenue y, al terminar (o saltar), vuelve a
 * MENU con el wipe de niebla.
 *
 * ARQUITECTURA — MISMA MÁQUINA DE BEATS data-first que `IntroScene`: los
 * pasos viven como DATOS en `EPILOGUE_BEATS` (`config/epilogue.ts`), cada
 * id tiene su «player» en el Record EXHAUSTIVO `this.beatPlayers`, el beat
 * se auto-avanza por tiempo o por tap, y hay flechas adelante/atrás + botón
 * «Saltar» idénticos a la intro.
 *
 * CONTRATO de los players (idempotencia ante taps rápidos, igual que la
 * intro): `advance()` limpia SIEMPRE el beat vigente (`clearBeatFx` mata el
 * timer, TODOS los tweens y los FX registrados en `this.beatFx`) y cada
 * player NORMALIZA el estado que necesita. Prohibido `delayedCall` propio:
 * los retardos van dentro de tweens. La salida tiene guard propio
 * (`this.exiting`).
 *
 * Fondo: estudio compuesto SOLO con texturas existentes
 * (`EPILOGUE_BACKGROUND`: niebla + `lab-bench` teñido de escritorio +
 * `parchment-frame` en miniatura como manuscrito) y el glow de la vela
 * titilando con `lampFlicker`.
 */
import Phaser from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { hexToNumber, nightBackground } from '../config/palette';
import { SceneKey } from '../config/sceneKeys';
import { ParallaxField } from '../art/ParallaxField';
import { lampFlicker } from '../art/parallax';
import { NARRATIVE_SKIP_BUTTON, type LoreBackgroundDef } from '../config/narrative';
import {
  EPILOGUE_BACKGROUND,
  EPILOGUE_BEATS,
  EPILOGUE_CANDLE,
  EPILOGUE_CLOSING,
  EPILOGUE_EMERGENCE,
  EPILOGUE_FOG,
  EPILOGUE_SCENE_LAYOUT,
  EPILOGUE_STUDY,
  EPILOGUE_TEXTURES,
  EpilogueBeatId,
  fogPuffTintFor,
  nextEpilogueBeatIndex,
  type EpilogueBeat,
  type EpilogueBeatId as EpilogueBeatIdType,
} from '../config/epilogue';
import { fadeIn, wipeTo } from './sceneNav';
import { getSystems } from '../systems/getSystems';
import type { AudioSystem } from '../systems/AudioSystem';
import { GothicButton } from '../ui/GothicButton';

/** Prop con brillo pulsante (vela del escritorio; igual que IntroScene). */
interface GlowingProp {
  sprite: Phaser.GameObjects.Image;
  baseAlpha: number;
  phase: number;
}

export class EpilogueScene extends Phaser.Scene {
  private audioSystem!: AudioSystem;
  /** Campo parallax del fondo (niebla lenta del estudio). */
  private field: ParallaxField | null = null;
  private backgroundObjects: Phaser.GameObjects.Image[] = [];
  private readonly glowing: GlowingProp[] = [];

  /** Utterson: aparece en el beat «Study» y queda leyendo hasta el final. */
  private utterson!: Phaser.GameObjects.Image;
  /**
   * La cara de Hyde: oculta hasta el beat «Emergence»; SIEMPRE DETRÁS de
   * Utterson (`hyde.depth < utterson.depth`) y SIN acercarse jamás.
   */
  private hyde!: Phaser.GameObjects.Image;
  private captionText!: Phaser.GameObjects.Text;

  /** Índice del beat vigente dentro de `EPILOGUE_BEATS`. */
  private beatIndex = 0;
  /** Timer de auto-avance del beat vigente (se retira al saltar). */
  private beatTimer?: Phaser.Time.TimerEvent;
  /** FX transitorios del beat vigente (se destruyen al avanzar/salir). */
  private readonly beatFx: Phaser.GameObjects.GameObject[] = [];
  /** Flechas del costado (adelante/atrás ENTRE BEATS). */
  private prevArrow!: Phaser.GameObjects.Image;
  private nextArrow!: Phaser.GameObjects.Image;
  /** True cuando ya se disparó la salida hacia MENU (anti doble tap). */
  private exiting = false;

  /**
   * Players por beat (Record EXHAUSTIVO: añadir un id a `EpilogueBeatId` sin
   * su player no compila). Cada uno es un bloque de tweens autocontenido.
   */
  private readonly beatPlayers: Readonly<
    Record<EpilogueBeatIdType, (beat: EpilogueBeat) => void>
  > = {
    [EpilogueBeatId.Study]: (beat) => this.playStudy(beat),
    [EpilogueBeatId.Fog]: (beat) => this.playFog(beat),
    [EpilogueBeatId.Emergence]: (beat) => this.playEmergence(beat),
    [EpilogueBeatId.Closing]: (beat) => this.playClosing(beat),
  };

  constructor() {
    super(SceneKey.EPILOGUE);
  }

  create(): void {
    const { audioSystem } = getSystems(this);
    this.audioSystem = audioSystem;

    fadeIn(this);
    this.cameras.main.setBackgroundColor(nightBackground);

    this.beatIndex = 0;
    this.exiting = false;
    this.beatFx.length = 0;

    this.buildBackground(EPILOGUE_BACKGROUND);
    this.buildActors();
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
  }

  // ---- Fondo (el estudio NO troca: un solo escenario para todo el epílogo) ----

  /**
   * Construye el fondo desde `EPILOGUE_BACKGROUND` (una `LoreBackgroundDef`):
   * capas de niebla con deriva + props estáticos (escritorio + manuscrito) y
   * el glow cálido de la vela titilando sobre el manuscrito (permanente: es
   * la luz del cuarto, no un FX de beat — por eso NO va a `beatFx`).
   */
  private buildBackground(def: LoreBackgroundDef): void {
    this.field = new ParallaxField(this, {
      layers: def.layers,
      ground: def.ground ? { color: def.ground.color, y: def.ground.y } : undefined,
    });

    for (const obj of this.backgroundObjects) {
      obj.destroy();
    }
    this.backgroundObjects = [];
    this.glowing.length = 0;

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

    this.spawnCandleGlow();
  }

  /**
   * La vela del escritorio: un puff cálido (`lampFire`) que titila DETRÁS
   * del manuscrito — la luz del cuarto. Registrado en `glowing` (flicker por
   * frame en `update`), como los props brillantes de la intro.
   */
  private spawnCandleGlow(): void {
    const manuscript = EPILOGUE_BACKGROUND.props[1];
    const x = manuscript.x + EPILOGUE_CANDLE.offsetX;
    const y = manuscript.y + EPILOGUE_CANDLE.offsetY;
    const glow = this.add
      .image(x, y, EPILOGUE_TEXTURES.puff)
      .setScale(EPILOGUE_CANDLE.scale)
      .setAlpha(EPILOGUE_CANDLE.alpha)
      .setTint(hexToNumber(EPILOGUE_CANDLE.color))
      .setDepth(manuscript.depth - 0.1);
    this.backgroundObjects.push(glow);
    this.glowing.push({ sprite: glow, baseAlpha: EPILOGUE_CANDLE.alpha, phase: 1.3 });
  }

  // ---- Actores fijos de la escena --------------------------------------------

  private buildActors(): void {
    const { utterson, hyde } = EPILOGUE_SCENE_LAYOUT;
    // Utterson entra invisible (el beat «Study» lo trae a escena).
    this.utterson = this.add
      .image(utterson.x, utterson.y, EPILOGUE_TEXTURES.utterson)
      .setScale(utterson.scale)
      .setDepth(utterson.depth)
      .setAlpha(0);
    // La cara de Hyde permanece oculta hasta «Emergence»: DETRÁS de
    // Utterson (depth menor) y sin voltear (mira a la derecha, hacia él).
    this.hyde = this.add
      .image(hyde.x, hyde.y, EPILOGUE_TEXTURES.hyde)
      .setScale(hyde.scale)
      .setDepth(hyde.depth)
      .setAlpha(0)
      .setVisible(false);
  }

  /** Letrero pergamino inferior (texto Crimson Text, SPEC §7.3). */
  private buildCaption(): void {
    const { caption } = EPILOGUE_SCENE_LAYOUT;
    this.add
      .image(caption.x, caption.y, EPILOGUE_TEXTURES.captionPanel)
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
      duration: EPILOGUE_SCENE_LAYOUT.caption.fadeMs,
      ease: 'Sine.easeInOut',
    });
  }

  private buildSkipButton(): void {
    const { skipButton } = EPILOGUE_SCENE_LAYOUT;
    new GothicButton(this, skipButton.x, skipButton.y, {
      label: NARRATIVE_SKIP_BUTTON.label,
      layout: NARRATIVE_SKIP_BUTTON.layout,
      onPress: (): void => this.onSkip(),
    }).setDepth(skipButton.depth);
  }

  // ---- Flechas del costado (adelante/atrás entre beats) -----------------------

  /** MISMA navegación que la intro: textura arrow, hitArea y feedback. */
  private buildNavArrows(): void {
    const { nav } = EPILOGUE_SCENE_LAYOUT;
    const hit = 100;
    const half = hit / 2;

    this.prevArrow = this.add
      .image(nav.marginX, nav.y, EPILOGUE_TEXTURES.arrow)
      .setScale(nav.scale)
      .setFlipX(true)
      .setDepth(nav.depth)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-half, -half, hit, hit),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      })
      .on(Phaser.Input.Events.POINTER_DOWN, () => this.onNavBack());

    this.nextArrow = this.add
      .image(BASE_WIDTH - nav.marginX, nav.y, EPILOGUE_TEXTURES.arrow)
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
    const { nav } = EPILOGUE_SCENE_LAYOUT;
    const canGoBack = this.beatIndex > 0 && !this.exiting;
    this.prevArrow.setAlpha(canGoBack ? 1 : nav.disabledAlpha);
    this.nextArrow.setAlpha(this.exiting ? nav.disabledAlpha : 1);
  }

  /** Feedback táctil del press (se restituye solo, como en la intro). */
  private pressFeedback(arrow: Phaser.GameObjects.Image): void {
    const { nav } = EPILOGUE_SCENE_LAYOUT;
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
    const beat = EPILOGUE_BEATS[index];
    this.beatPlayers[beat.id](beat);
    // Auto-avance al agotarse la duración del beat (el tap lo adelanta).
    this.beatTimer = this.time.delayedCall(beat.durationMs, () => this.advance());
    this.updateNavArrows();
  }

  /**
   * Guard anti taps rápidos entre beats: retira el timer y TODO tween/FX del
   * beat vigente antes de entrar al siguiente (idéntico a la intro).
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

  /** Tap en cualquier parte: avanza al siguiente beat (o cierra el epílogo). */
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
    const next = nextEpilogueBeatIndex(this.beatIndex);
    if (next < 0) {
      // Último beat completado: la niebla lo cubre todo → de vuelta al MENU.
      this.exitToMenu();
      return;
    }
    this.enterBeat(next);
  }

  private onSkip(): void {
    if (this.exiting) {
      return;
    }
    this.audioSystem.blip();
    this.exitToMenu();
  }

  /** Cierre ÚNICO del epílogo (guard de reentrada propio + el de `wipeTo`). */
  private exitToMenu(): void {
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
    // El save y la tanda ya quedaron como corresponden al ENTRAR a VICTORY
    // (markLevelComplete = récord + sin «Continuar»): el epílogo no toca nada.
    wipeTo(this, SceneKey.MENU);
  }

  // ---- Beat 1 — STUDY: Utterson aparece leyendo la confesión ------------------

  private playStudy(beat: EpilogueBeat): void {
    const { utterson, hyde } = EPILOGUE_SCENE_LAYOUT;

    // Normaliza (un tap o la flecha «atrás» pudo cortar el beat anterior).
    this.utterson
      .setVisible(true)
      .setPosition(utterson.x, utterson.y)
      .setRotation(0)
      .setScale(utterson.scale * EPILOGUE_STUDY.scaleFrom)
      .setAlpha(0);
    this.hyde.setVisible(false).setAlpha(0).setPosition(hyde.x, hyde.y).setScale(hyde.scale);

    // Entrada suave: fade + pop de escala (Back.easeOut), como Jekyll.
    this.tweens.add({
      targets: this.utterson,
      alpha: { from: 0, to: 1 },
      duration: EPILOGUE_STUDY.fadeMs,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.utterson,
      scale: { from: utterson.scale * EPILOGUE_STUDY.scaleFrom, to: utterson.scale },
      duration: EPILOGUE_STUDY.fadeMs + 200,
      ease: 'Back.easeOut',
    });
    // Respiración sutil mientras dura el beat (muere con clearBeatFx).
    this.tweens.add({
      targets: this.utterson,
      y: utterson.y - 6,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.showCaption(beat.caption);
  }

  // ---- Beat 2 — FOG: la niebla crece alrededor del escritorio -----------------

  private playFog(beat: EpilogueBeat): void {
    const { utterson } = EPILOGUE_SCENE_LAYOUT;

    // Normaliza: Utterson ya en su sitio, entero; Hyde aún fuera de escena.
    this.utterson
      .setVisible(true)
      .setPosition(utterson.x, utterson.y)
      .setRotation(0)
      .setScale(utterson.scale)
      .setAlpha(1);
    this.hyde.setVisible(false).setAlpha(0);

    this.spawnFogGrowth();

    this.showCaption(beat.caption);
  }

  /** Velo de niebla creciente + puffs deterministas por toda la escena. */
  private spawnFogGrowth(): void {
    const F = EPILOGUE_FOG;
    const { fogVeilDepth } = EPILOGUE_SCENE_LAYOUT;
    const veil = this.add
      .rectangle(
        BASE_WIDTH / 2,
        BASE_HEIGHT / 2,
        BASE_WIDTH,
        BASE_HEIGHT,
        hexToNumber(F.veil.color),
        0,
      )
      .setDepth(fogVeilDepth);
    this.beatFx.push(veil);
    this.tweens.add({
      targets: veil,
      alpha: { from: 0, to: F.veil.alpha },
      duration: F.veil.durationMs,
      ease: 'Sine.easeInOut',
    });
    for (let i = 0; i < F.puffs.count; i++) {
      // Reparto determinista por el ancho (4 puffs: 0.2, 0.4, 0.6, 0.8).
      const fx = (i + 1) / (F.puffs.count + 1);
      const puff = this.add
        .image(
          BASE_WIDTH * fx,
          BASE_HEIGHT * (0.58 + (i % 2) * 0.12),
          EPILOGUE_TEXTURES.puff,
        )
        .setScale(F.puffs.scale * 0.5)
        .setAlpha(0)
        .setTint(hexToNumber(fogPuffTintFor(i)))
        .setDepth(fogVeilDepth + 0.5);
      this.beatFx.push(puff);
      this.tweens.add({
        targets: puff,
        scale: { from: F.puffs.scale * 0.5, to: F.puffs.scale },
        alpha: { from: 0.5, to: 0 },
        y: puff.y - 46,
        delay: i * F.puffs.staggerMs,
        duration: F.puffs.durationMs,
        ease: 'Sine.easeOut',
      });
    }
  }

  // ---- Beat 3 — EMERGENCE: la cara de Hyde emerge DETRÁS de Utterson ----------

  private playEmergence(beat: EpilogueBeat): void {
    const { utterson, hyde } = EPILOGUE_SCENE_LAYOUT;
    const E = EPILOGUE_EMERGENCE;
    const startY = hyde.y + E.risePx; // nace MÁS ABAJO (de las sombras)…

    // Normaliza: Utterson entero leyendo; la cara de Hyde DETRÁS de él
    // (depth menor, SIN voltear y SIN acercarse: solo crece y se alza).
    this.utterson
      .setVisible(true)
      .setPosition(utterson.x, utterson.y)
      .setRotation(0)
      .setScale(utterson.scale)
      .setAlpha(1);
    this.hyde
      .setVisible(true)
      .setPosition(hyde.x, startY)
      .setRotation(0)
      .setScale(hyde.scale * E.scaleFrom)
      .setAlpha(0);

    // Golpe dramático (thump respeta mute/desbloqueo internamente).
    this.audioSystem.thump();

    // Volutas de humo OSCURO (`hydeSmoke`) anunciando la sombra…
    this.spawnEmergenceSmoke();
    // …mientras la cara emerge: fade + CRECIMIENTO hasta GIGANTE + alzarse
    // (se ALEJA hacia arriba: jamás un acercamiento a Utterson).
    this.tweens.add({
      targets: this.hyde,
      alpha: { from: 0, to: 1 },
      delay: E.delayMs,
      duration: E.fadeMs,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: this.hyde,
      scale: { from: hyde.scale * E.scaleFrom, to: hyde.scale * E.scaleTo },
      delay: E.delayMs,
      duration: E.fadeMs + 500,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.hyde,
      y: { from: startY, to: hyde.y },
      delay: E.delayMs,
      duration: E.fadeMs + 500,
      ease: 'Sine.easeOut',
    });

    this.showCaption(beat.caption);
  }

  /**
   * Volutas de humo OSCURO que SERPENTEAN subiendo alrededor de la cara
   * (deterministas: offsets y desfases fijos por índice), igual que el humo
   * de la transformación. Todo con tweens (nada de `delayedCall` propio) y
   * registrado en `beatFx`: `clearBeatFx` lo mata todo.
   */
  private spawnEmergenceSmoke(): void {
    const { hyde } = EPILOGUE_SCENE_LAYOUT;
    const D = EPILOGUE_EMERGENCE.darkPuffs;
    for (let i = 0; i < D.count; i++) {
      // Reparto determinista: alterna costados y arranca abajo (las sombras).
      const side = i % 2 === 0 ? -1 : 1;
      const startX = hyde.x + side * (60 + i * 34);
      const startY = hyde.y + 150 - i * 60;
      const puff = this.add
        .image(startX, startY, EPILOGUE_TEXTURES.puff)
        .setScale(D.scale * 0.4)
        .setAlpha(0)
        .setTint(hexToNumber(D.color))
        .setDepth(hyde.depth + 0.4);
      this.beatFx.push(puff);
      // Subida completa (el serpenteo dura lo mismo que el ascenso).
      this.tweens.add({
        targets: puff,
        y: startY - D.risePx,
        delay: D.staggerMs * 0.4 + i * D.staggerMs,
        duration: D.durationMs,
        ease: 'Sine.easeOut',
      });
      // Serpenteo: mecido horizontal de ida y vuelta alrededor de la cara.
      this.tweens.add({
        targets: puff,
        x: startX + side * D.swayPx,
        delay: D.staggerMs * 0.4 + i * D.staggerMs,
        duration: D.durationMs / 2,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
      });
      // Aparece, respira y se disipa dentro de la misma subida (yoyo alfa).
      this.tweens.add({
        targets: puff,
        alpha: { from: 0, to: D.peakAlpha },
        delay: D.staggerMs * 0.4 + i * D.staggerMs,
        duration: D.durationMs / 2,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // ---- Beat 4 — CLOSING: cartela final + flash tenue ---------------------------

  private playClosing(beat: EpilogueBeat): void {
    const { utterson, hyde } = EPILOGUE_SCENE_LAYOUT;
    const C = EPILOGUE_CLOSING;

    // Normaliza: Utterson entero; la cara de Hyde en su pose GIGANTE de
    // fondo (DETRÁS, tras el alzamiento del beat anterior).
    this.utterson
      .setVisible(true)
      .setPosition(utterson.x, utterson.y)
      .setRotation(0)
      .setScale(utterson.scale)
      .setAlpha(1);
    this.hyde
      .setVisible(true)
      .setPosition(hyde.x, hyde.y)
      .setRotation(0)
      .setScale(hyde.scale * EPILOGUE_EMERGENCE.scaleTo)
      .setAlpha(1);

    // La cara sigue VIVA pero sin acercarse: una respiración mínica de
    // escala (crece un pelín y vuelve). Jamás un desplazamiento hacia él.
    this.tweens.add({
      targets: this.hyde,
      scale: {
        from: hyde.scale * EPILOGUE_EMERGENCE.scaleTo,
        to: hyde.scale * (EPILOGUE_EMERGENCE.scaleTo + C.breathe.scaleExtra),
      },
      duration: C.breathe.cycleMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 1) Flash TENUE fullscreen: sube al pico y baja (yoyo) — el pulso del
    //    relámpago de la viñeta final, frío y breve.
    const flash = this.add
      .rectangle(
        BASE_WIDTH / 2,
        BASE_HEIGHT / 2,
        BASE_WIDTH,
        BASE_HEIGHT,
        hexToNumber(C.flash.color),
        0,
      )
      .setDepth(EPILOGUE_SCENE_LAYOUT.flashDepth);
    this.beatFx.push(flash);
    this.tweens.add({
      targets: flash,
      alpha: { from: 0, to: C.flash.peakAlpha },
      duration: C.flash.durationMs / 2,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });

    // 2) Velo extra de sombra (`hydeSmoke`) cerrando la escena a oscuras…
    const shadow = this.add
      .rectangle(
        BASE_WIDTH / 2,
        BASE_HEIGHT / 2,
        BASE_WIDTH,
        BASE_HEIGHT,
        hexToNumber(C.shadowVeil.color),
        0,
      )
      .setDepth(EPILOGUE_SCENE_LAYOUT.fogVeilDepth);
    this.beatFx.push(shadow);
    this.tweens.add({
      targets: shadow,
      alpha: { from: 0, to: C.shadowVeil.alpha },
      duration: C.shadowVeil.durationMs,
      ease: 'Sine.easeInOut',
    });

    // 3) …y los últimos puffs de niebla cruzando la escena (al completarse
    //    este beat, el flujo existente cierra con el wipe hacia MENU).
    this.spawnClosingPuffs();

    this.showCaption(beat.caption);
  }

  /** Últimos puffs de niebla (reparto determinista, como el cierre de la intro). */
  private spawnClosingPuffs(): void {
    const C = EPILOGUE_CLOSING;
    const { fogVeilDepth } = EPILOGUE_SCENE_LAYOUT;
    for (let i = 0; i < C.puffs.count; i++) {
      const fx = (i + 1) / (C.puffs.count + 1);
      const puff = this.add
        .image(
          BASE_WIDTH * fx,
          BASE_HEIGHT * (0.6 + (i % 2) * 0.1),
          EPILOGUE_TEXTURES.puff,
        )
        .setScale(C.puffs.scale * 0.5)
        .setAlpha(0)
        .setTint(hexToNumber(fogPuffTintFor(i)))
        .setDepth(fogVeilDepth + 0.5);
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
