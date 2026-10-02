/**
 * MENU (SPEC §3, §6 / PLAN Etapa 2): splash gótico.
 *
 *  - Fondo de callejón con niebla en deriva (parallax data-driven: la tabla
 *    `MENU_PARALLAX_LAYERS` de `src/art/parallax.ts` + `driftOffset` pura;
 *    este archivo solo consume datos). Farolas con flicker (`lampFlicker`).
 *  - Título «Jekyll & Hyde [TBD]» (placeholder, SPEC §1.1) con fade-in en
 *    UnifrakturCook (clave CSS, cargada en PRELOAD) + subtítulo del SPEC §6.
 *  - Botones GothicButton desde `menuButtonsFor(save)`: «Comenzar el viaje»,
 *    «Cómo jugar» y «Continuar» SOLO si `save.inProgress` (SPEC §11).
 *    v1: «Comenzar» y «Continuar» van AMBOS a NARRATIVE (reanudar = narrativa
 *    del N1, SPEC §3); «Comenzar» además marca `inProgress = true` para que
 *    «Continuar» aparezca en la próxima visita (SPEC §11: se guarda al
 *    comenzar nivel).
 *  - Overlay «Cómo jugar» (3 pasos con iconos procedurales, `HOW_TO_PLAY`)
 *    cerrable con botón «Cerrar».
 *  - Toggle de mute (icono altavoz on/off): persiste vía SaveSystem y
 *    sobrevive recargas.
 *  - Viento de entrada (`AudioSystem.wind`, SPEC §8) SOLO si el audio ya
 *    está desbloqueado por un gesto anterior (políticas de autoplay).
 */
import Phaser from 'phaser';
import {
  HOW_TO_PLAY,
  HOW_TO_PLAY_CLOSE_LABEL,
  HOW_TO_PLAY_TITLE,
  MENU_SUBTITLE,
  MENU_TITLE,
  MenuButtonId,
  beginJourney,
  menuButtonsFor,
} from '../config/menu';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { hexToNumber, nightBackground, parchmentDark, parchmentLight, street, textPrimary } from '../config/palette';
import { SceneKey } from '../config/sceneKeys';
import { TEXTURE_KEYS } from '../art/textures';
import {
  MENU_PARALLAX_LAYERS,
  STREET_LINE_Y,
  driftOffset,
  lampFlicker,
  slotDrift,
} from '../art/parallax';
import { fadeIn, transitionTo } from './sceneNav';
import { getSystems } from '../systems/getSystems';
import type { AudioSystem } from '../systems/AudioSystem';
import type { SaveSystem } from '../systems/SaveSystem';
import type { DriftParams } from '../art/parallax';
import { GothicButton } from '../ui/GothicButton';

/** Profundidades de pintado (la niebla cercana queda bajo la UI, SPEC §9). */
const DEPTH_UI = 10;
const DEPTH_OVERLAY = 50;

/** Timing del fade-in del titular (ms). */
const TITLE_FADE_MS = 1200;
const SUBTITLE_FADE_MS = 900;

/** Tamaño del icono de mute y su hitbox táctil (≥ 64 px, SPEC §9). */
const MUTE_ICON_SIZE = 64;
const MUTE_HIT_SIZE = 88;

/** Un sprite de capa parallax con su deriva precalculada. */
interface DriftingSprite {
  sprite: Phaser.GameObjects.Image;
  baseX: number;
  drift: DriftParams;
}

/** Farola con su propio ritmo de flicker. */
interface FlickeringLamp {
  sprite: Phaser.GameObjects.Image;
  speed: number;
  phase: number;
}

export class MenuScene extends Phaser.Scene {
  private readonly drifting: DriftingSprite[] = [];
  private readonly lamps: FlickeringLamp[] = [];
  private systems!: { saveSystem: SaveSystem; audioSystem: AudioSystem };
  private muteIcon!: Phaser.GameObjects.Image;
  private howToPlayOverlay!: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKey.MENU);
  }

  create(): void {
    this.drifting.length = 0;
    this.lamps.length = 0;
    const { saveSystem, audioSystem } = getSystems(this);
    this.systems = { saveSystem, audioSystem };

    fadeIn(this);
    this.cameras.main.setBackgroundColor(nightBackground);

    this.buildAlley();
    this.buildTitle();
    this.buildButtons();
    this.buildMuteToggle();
    this.buildHowToPlayOverlay();

    // Viento al entrar al menú (SPEC §8) — solo si un gesto anterior ya
    // desbloqueó el AudioContext; wind() además respeta el mute internamente.
    if (audioSystem.isUnlocked) {
      audioSystem.wind();
    }
  }

  update(time: number): void {
    const t = time / 1000;
    for (const entry of this.drifting) {
      entry.sprite.x = entry.baseX + driftOffset(t, entry.drift);
    }
    for (const lamp of this.lamps) {
      lamp.sprite.alpha = lampFlicker(t + lamp.phase, 0.78, lamp.speed);
    }
  }

  // ---- Fondo: callejón + niebla parallax ----------------------------------

  private buildAlley(): void {
    // Banda de calle/adoquines bajo la línea de calle (paleta §7.1).
    this.add
      .rectangle(BASE_WIDTH / 2, (STREET_LINE_Y + BASE_HEIGHT) / 2, BASE_WIDTH, BASE_HEIGHT - STREET_LINE_Y + 40, hexToNumber(street))
      .setDepth(0.5);

    MENU_PARALLAX_LAYERS.forEach((layer, layerIndex) => {
      for (const slot of layer.slots) {
        const sprite = this.add
          .image(slot.x, slot.y, layer.key)
          .setScale(slot.scale)
          .setAlpha(layer.alpha)
          .setDepth(layer.depth);
        if (layer.tint) {
          sprite.setTint(hexToNumber(layer.tint));
        }
        this.drifting.push({ sprite, baseX: slot.x, drift: slotDrift(layer, slot) });
        if (layer.key === TEXTURE_KEYS.lampPost) {
          // Cada farola parpadea con su propio ritmo (SPEC §7.2 flicker).
          this.lamps.push({ sprite, speed: 4.2 + layerIndex * 1.3, phase: slot.phaseOffset });
        }
      }
    });
  }

  // ---- Titular con fade-in ---------------------------------------------------

  private buildTitle(): void {
    // Título placeholder (SPEC §1.1) en UnifrakturCook (clave CSS cargada
    // en PRELOAD, SPEC §7.3) con fade-in lento.
    const title = this.add
      .text(BASE_WIDTH / 2, 230, MENU_TITLE, {
        fontFamily: 'UnifrakturCook, Georgia, serif',
        fontSize: '68px',
        color: parchmentLight,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_UI)
      .setAlpha(0)
      // Sombra suave: separa el titular de la niebla (contraste, SPEC §9).
      .setShadow(0, 4, nightBackground, 12, true, true);
    this.tweens.add({
      targets: title,
      alpha: { from: 0, to: 1 },
      duration: TITLE_FADE_MS,
      delay: 150,
      ease: 'Sine.easeInOut',
    });

    const subtitle = this.add
      .text(BASE_WIDTH / 2, 322, MENU_SUBTITLE, {
        fontFamily: '"Special Elite", Georgia, serif',
        fontSize: '30px',
        color: textPrimary,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_UI)
      .setAlpha(0);
    this.tweens.add({
      targets: subtitle,
      alpha: { from: 0, to: 1 },
      duration: SUBTITLE_FADE_MS,
      delay: 800,
      ease: 'Sine.easeInOut',
    });
  }

  // ---- Botones principales ---------------------------------------------------

  private buildButtons(): void {
    const buttons = menuButtonsFor(this.systems.saveSystem.getData());
    const spacing = 132;
    const yStart = buttons.length === 3 ? 850 : 900;

    buttons.forEach((descriptor, index) => {
      const button = new GothicButton(this, BASE_WIDTH / 2, yStart + index * spacing, {
        label: descriptor.label,
        onPress: (): void => this.onMenuButton(descriptor.id),
      });
      button.setDepth(DEPTH_UI);
    });
  }

  /** Acciones de los botones del menú (identidades de `MenuButtonId`). */
  private onMenuButton(id: string): void {
    const { saveSystem, audioSystem } = this.systems;
    audioSystem.blip();
    if (id === MenuButtonId.Start) {
      // SPEC §11: guardar al comenzar nivel → «Continuar» visible después.
      beginJourney(saveSystem);
      // v1: igual destino que «Continuar» (narrativa del N1).
      transitionTo(this, SceneKey.NARRATIVE);
      return;
    }
    if (id === MenuButtonId.Continue) {
      // v1: reanudar = narrativa del N1 (sin checkpoint por panel todavía).
      transitionTo(this, SceneKey.NARRATIVE);
      return;
    }
    if (id === MenuButtonId.HowToPlay) {
      this.openHowToPlay();
    }
  }

  // ---- Toggle de mute ----------------------------------------------------------

  private buildMuteToggle(): void {
    const { audioSystem } = this.systems;
    const container = this.add.container(BASE_WIDTH - MUTE_HIT_SIZE / 2 - 24, MUTE_HIT_SIZE / 2 + 24).setDepth(DEPTH_UI + 1);
    this.muteIcon = this.add
      .image(0, 0, audioSystem.muted ? TEXTURE_KEYS.speakerOff : TEXTURE_KEYS.speakerOn)
      .setDisplaySize(MUTE_ICON_SIZE, MUTE_ICON_SIZE);
    container.add(this.muteIcon);
    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(
        -MUTE_HIT_SIZE / 2,
        -MUTE_HIT_SIZE / 2,
        MUTE_HIT_SIZE,
        MUTE_HIT_SIZE,
      ),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    container.on(Phaser.Input.Events.POINTER_DOWN, () => {
      const muted = audioSystem.toggleMute(); // persiste vía SaveSystem (SPEC §11)
      this.muteIcon.setTexture(muted ? TEXTURE_KEYS.speakerOff : TEXTURE_KEYS.speakerOn);
      if (!muted) {
        audioSystem.blip(); // confirmación audible al reactivar el sonido
      }
    });
  }

  // ---- Overlay «Cómo jugar» -----------------------------------------------------

  private buildHowToPlayOverlay(): void {
    const overlay = this.add.container(0, 0).setDepth(DEPTH_OVERLAY).setVisible(false);
    this.howToPlayOverlay = overlay;

    // Velo oscuro interactivo: además de oscurecer, se come los taps para
    // que los botones del menú (depth menor) no respondan debajo. Hit area
    // explícita (los shapes no derivan hit area de textura).
    const veil = this.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, hexToNumber(nightBackground), 0.88)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(
          -BASE_WIDTH / 2,
          -BASE_HEIGHT / 2,
          BASE_WIDTH,
          BASE_HEIGHT,
        ),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      });
    overlay.add(veil);

    // Panel pergamino (textura procedural de la Etapa 1) estirado a panel.
    overlay.add(
      this.add.image(BASE_WIDTH / 2, BASE_HEIGHT / 2, TEXTURE_KEYS.parchmentFrame).setDisplaySize(600, 980),
    );

    overlay.add(
      this.add
        .text(BASE_WIDTH / 2, 220, HOW_TO_PLAY_TITLE, {
          fontFamily: 'UnifrakturCook, Georgia, serif',
          fontSize: '56px',
          color: parchmentDark,
        })
        .setOrigin(0.5),
    );

    // 3 pasos: icono procedural a la izquierda, textos cortos a la derecha.
    HOW_TO_PLAY.forEach((step, index) => {
      const rowY = 390 + index * 190;
      overlay.add(this.add.image(180, rowY, step.iconKey).setDisplaySize(112, 112));
      overlay.add(
        this.add
          .text(264, rowY - 30, step.title, {
            fontFamily: '"Special Elite", Georgia, serif',
            fontSize: '36px',
            color: parchmentDark,
          })
          .setOrigin(0, 0.5),
      );
      overlay.add(
        this.add
          .text(264, rowY + 20, step.text, {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '28px',
            color: parchmentDark,
            wordWrap: { width: 300 },
            lineSpacing: 6,
          })
          .setOrigin(0, 0),
      );
    });

    const closeButton = new GothicButton(this, BASE_WIDTH / 2, 1080, {
      label: HOW_TO_PLAY_CLOSE_LABEL,
      onPress: (): void => {
        this.systems.audioSystem.blip();
        overlay.setVisible(false);
      },
    });
    closeButton.setDepth(DEPTH_OVERLAY + 1);
    overlay.add(closeButton);
  }

  private openHowToPlay(): void {
    this.howToPlayOverlay.setVisible(true);
  }
}
