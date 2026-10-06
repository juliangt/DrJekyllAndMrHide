/**
 * Fase 3 — test de los DATOS de las secuencias animadas (gameplay/
 * actionSequences): la escena solo CONSUME estas tablas, así que su
 * coherencia (timings positivos, texturas existentes, factores razonables)
 * se valida sin Phaser.
 */
import { describe, expect, it } from 'vitest';
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
import { TEXTURE_KEYS } from '../art/textures';
import { parchmentDark } from '../config/palette';

describe('CANE_SWING — el swing del bastón de mango blanco (N2)', () => {
  it('pool acotado y swing teatral de ~200–300 ms', () => {
    expect(CANE_SWING.poolSize).toBeGreaterThanOrEqual(1);
    expect(CANE_SWING.poolSize).toBeLessThanOrEqual(2); // SPEC §10.4
    expect(CANE_SWING.ms).toBeGreaterThanOrEqual(200);
    expect(CANE_SWING.ms).toBeLessThanOrEqual(300);
    expect(CANE_SWING.strikeFraction).toBeGreaterThan(0);
    expect(CANE_SWING.strikeFraction).toBeLessThan(1);
  });

  it('arma el golpe hacia arriba y baja al impacto (ángulos coherentes)', () => {
    expect(CANE_SWING.fromRad).toBeLessThan(0); // armado hacia arriba
    expect(CANE_SWING.toRad).toBeGreaterThan(0); // impacto hacia abajo
    expect(CANE_SWING.originX).toBeGreaterThan(0.5); // pivote en el puño
  });
});

describe('NEAR_MISS_HOP — el hop de esquiva (N2, feedback sin castigo)', () => {
  it('expansión mayor que la hitbox +20 % y brinco breve', () => {
    expect(NEAR_MISS_HOP.expansion).toBeGreaterThan(1.2); // sobre la generosa
    expect(NEAR_MISS_HOP.hopPx).toBeGreaterThan(0);
    expect(NEAR_MISS_HOP.ms).toBeLessThan(400);
  });
});

describe('FALL_SEQUENCE — la caída caricaturesca (N2/N3, sin sangre D4)', () => {
  it('timings positivos; el reducer espera tween + settle', () => {
    expect(FALL_SEQUENCE.tweenMs).toBeGreaterThan(0);
    expect(FALL_SEQUENCE.settleMs).toBeGreaterThan(0);
    expect(FALL_SEQUENCE.rotationRad).toBeGreaterThan(0);
    expect(FALL_SEQUENCE.groundPuffs).toBeGreaterThanOrEqual(1);
  });
});

describe('VICTORY_LINE — la línea de Hyde en pergamino (N2)', () => {
  it('usa el marco pergamino del quiz y la tipografía Special Elite', () => {
    expect(VICTORY_LINE.textureKey).toBe(TEXTURE_KEYS.parchmentFrame);
    expect(VICTORY_LINE.textStyle.fontFamily).toContain('Special Elite');
    expect(VICTORY_LINE.textStyle.color).toBe(parchmentDark); // sepia sobre claro
  });

  it('se lee ~1.6 s (fase line del reducer) con pop-in breve', () => {
    expect(VICTORY_LINE.holdMs).toBeGreaterThanOrEqual(1500);
    expect(VICTORY_LINE.holdMs).toBeLessThanOrEqual(1800);
    expect(VICTORY_LINE.popMs).toBeLessThan(VICTORY_LINE.holdMs);
    expect(VICTORY_LINE.panelWidth).toBeLessThanOrEqual(720); // lienzo base
  });
});

describe('TRANSFORM_ANIM / JEKYLL — la transformación (N3)', () => {
  it('animación breve con wobble en contrafase y aura pulsante', () => {
    expect(TRANSFORM_ANIM.wobbleMs).toBeLessThan(600);
    expect(TRANSFORM_ANIM.wobbleScaleX).toBeGreaterThan(0);
    expect(TRANSFORM_ANIM.wobbleScaleY).toBeGreaterThan(0);
    expect(TRANSFORM_ANIM.auraMs).toBeLessThan(1000);
    expect(TRANSFORM_ANIM.auraAlpha).toBeLessThan(0.7); // presente pero discreta
  });

  it('la tregua de Jekyll reduce la velocidad SIN anularla', () => {
    expect(JEKYLL_SPEED_FACTOR).toBeGreaterThan(0);
    expect(JEKYLL_SPEED_FACTOR).toBeLessThan(1);
  });

  it('el mensaje pedagógico es amable y menciona a Jekyll', () => {
    expect(JEKYLL_MISS_NOTICE.text).toContain('Jekyll');
    expect(JEKYLL_MISS_NOTICE.ms).toBeGreaterThanOrEqual(1000);
    expect(JEKYLL_MISS_NOTICE.wrapWidth).toBeLessThanOrEqual(720);
  });
});

describe('SIEGE_INTRO / SIEGE_ENTRANCE — la cinemática de la puerta (N3)', () => {
  it('3–4 golpes de puerta con shake corto (SPEC §7.2)', () => {
    expect(SIEGE_INTRO.knockCount).toBeGreaterThanOrEqual(3);
    expect(SIEGE_INTRO.knockCount).toBeLessThanOrEqual(4);
    expect(SIEGE_INTRO.shakeMs).toBeLessThanOrEqual(150);
    expect(SIEGE_INTRO.shakeIntensity).toBeLessThan(0.01);
    expect(SIEGE_INTRO.skippable).toBe(true); // accesibilidad SPEC §9
  });

  it('la intro completa dura 2.5–3.5 s (golpes + apertura + respiro)', () => {
    const total = SIEGE_INTRO.knockCount * SIEGE_INTRO.knockIntervalMs +
      SIEGE_INTRO.doorOpenMs + SIEGE_INTRO.settleMs;
    expect(total).toBeGreaterThanOrEqual(2500);
    expect(total).toBeLessThanOrEqual(3500);
  });

  it('la entrada final camina ~2 s hasta el QUIZ, con bob suave', () => {
    const total = SIEGE_ENTRANCE.walkMs + SIEGE_ENTRANCE.settleMs;
    expect(total).toBeGreaterThanOrEqual(1800);
    expect(total).toBeLessThanOrEqual(2600);
    expect(SIEGE_ENTRANCE.bobPx).toBeLessThan(10);
  });
});

describe('STAR_TWINKLE — el cielo del N2', () => {
  it('pool acotado de estrellas dentro del lienzo, con titileo visible', () => {
    expect(STAR_TWINKLE.slots.length).toBeLessThanOrEqual(8);
    for (const slot of STAR_TWINKLE.slots) {
      expect(slot.x).toBeGreaterThanOrEqual(0);
      expect(slot.x).toBeLessThanOrEqual(720);
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeLessThanOrEqual(1280);
    }
    expect(STAR_TWINKLE.minAlpha).toBeGreaterThan(0);
    expect(STAR_TWINKLE.minAlpha).toBeLessThan(0.5);
    expect(STAR_TWINKLE.speed).toBeGreaterThan(0);
  });
});
