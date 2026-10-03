/**
 * ParallaxField (PLAN Etapa 4): campo de capas parallax REUTILIZABLE —
 * extracción de la lógica que Etapa 2 (MenuScene) y Etapa 3
 * (NarrativeScene) tenían duplicada. Consume las TABLAS PURAS de
 * `art/parallax.ts` (`ParallaxLayer[]`) + `driftOffset`/`slotDrift`/
 * `lampFlicker`, así las escenas quedan como capas finas.
 *
 * Qué encapsula:
 *  - La banda de suelo (adoquines bajo la línea de calle) si se pide.
 *  - Un sprite por slot con su textura/tinte/alfa/depth de la tabla.
 *  - El registro de deriva por sprite (x = baseX + driftOffset(t)) y de
 *    farolas (flicker de alfa con ritmo propio por slot).
 *
 * Todo el estado vive en este objeto: `update(t)` por frame, `destroy()`
 * al trocar de fondo o apagar la escena (los sprites se destruyen — el pool
 * acotado es el de la tabla, ≤ 30 slots de niebla, SPEC §10.4).
 */
import Phaser from 'phaser';
import { hexToNumber, type HexColor } from '../config/palette';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { TEXTURE_KEYS } from './textures';
import {
  driftOffset,
  lampFlicker,
  slotDrift,
  type DriftParams,
  type ParallaxLayer,
} from './parallax';

/** Banda de suelo bajo la línea de calle (solo exteriores). */
export interface ParallaxGround {
  color: HexColor;
  /** Y donde empieza la banda (hasta el borde inferior del lienzo). */
  y: number;
  /** Sangrado inferior extra (px) para cubrir el borde por seguridad. */
  bleedY?: number;
}

/** Opciones de construcción del campo. */
export interface ParallaxFieldOptions {
  layers: readonly ParallaxLayer[];
  ground?: ParallaxGround;
}

/** Un sprite de capa con su deriva precalculada. */
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

export class ParallaxField {
  private readonly objects: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle> = [];
  private readonly drifting: DriftingSprite[] = [];
  private readonly lamps: FlickeringLamp[] = [];
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: ParallaxFieldOptions) {
    if (options.ground) {
      const { color, y, bleedY = 0 } = options.ground;
      const bottom = BASE_HEIGHT + bleedY;
      this.objects.push(
        scene.add
          .rectangle(BASE_WIDTH / 2, (y + bottom) / 2, BASE_WIDTH, bottom - y, hexToNumber(color))
          .setDepth(0.5),
      );
    }

    options.layers.forEach((layer, layerIndex) => {
      for (const slot of layer.slots) {
        const sprite = scene.add
          .image(slot.x, slot.y, layer.key)
          .setScale(slot.scale)
          .setAlpha(layer.alpha)
          .setDepth(layer.depth);
        if (layer.tint) {
          sprite.setTint(hexToNumber(layer.tint));
        }
        this.objects.push(sprite);
        this.drifting.push({ sprite, baseX: slot.x, drift: slotDrift(layer, slot) });
        if (layer.key === TEXTURE_KEYS.lampPost) {
          // Cada farola parpadea con su propio ritmo (SPEC §7.2 flicker).
          this.lamps.push({
            sprite,
            speed: 4.2 + layerIndex * 1.3,
            phase: slot.phaseOffset,
          });
        }
      }
    });
  }

  /**
   * Deriva de las capas + flicker de farolas para el instante `t` (s).
   * Barato: asignaciones de x/alpha, nada de texturas ni allocations.
   */
  update(timeSec: number): void {
    if (this.destroyed) {
      return;
    }
    for (const entry of this.drifting) {
      entry.sprite.x = entry.baseX + driftOffset(timeSec, entry.drift);
    }
    for (const lamp of this.lamps) {
      lamp.sprite.alpha = lampFlicker(timeSec + lamp.phase, 0.78, lamp.speed);
    }
  }

  /** Destruye los sprites del campo (para trocar fondo o apagar escena). */
  destroy(): void {
    this.destroyed = true;
    this.drifting.length = 0;
    this.lamps.length = 0;
    for (const object of this.objects) {
      object.destroy();
    }
    this.objects.length = 0;
  }
}
