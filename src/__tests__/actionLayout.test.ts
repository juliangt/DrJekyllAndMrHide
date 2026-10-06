/**
 * Etapa 4 — test del layout de la escena de acción (DATOS PUROS): coherencia
 * con el lienzo 720×1280, la zona de juego deja fuera HUD y suelo, la niña
 * (con hitbox +20 %) cabe entera en el lienzo, depths niebla < UI, botón
 * pausa táctil ≥ 64 px, y el presupuesto de sprites de niebla ≤ 30
 * (SPEC §10.4) integrando la tabla ACTION_PARALLAX_LAYERS.
 */
import { describe, expect, it } from 'vitest';
import {
  ACTION_DT_CAP_MS,
  ACTION_FEEDBACK,
  ACTION_LAYOUT,
  ACTION_PAUSE_BUTTON,
  FPS_DEBUG_STYLE,
  GIRL_WALK_BOB,
  MAX_FOG_SPRITES,
  PUFF_POOL_SIZE,
} from '../gameplay/actionLayout';
import { ACTION_PARALLAX_LAYERS } from '../art/parallax';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { PALETTE, error, lampFire, parchmentDark, textPrimary } from '../config/palette';
import { DEFAULT_HITBOX_EXPANSION } from '../gameplay/hitbox';
import { MIN_TOUCH_HEIGHT } from '../ui/buttonState';

const { playZone, hud, depths, girl } = ACTION_LAYOUT;

describe('zona de juego (SPEC §4.2: rebote fuera de HUD y suelo)', () => {
  it('límites bien ordenados (min < max en ambos ejes)', () => {
    expect(playZone.minX).toBeLessThan(playZone.maxX);
    expect(playZone.minY).toBeLessThan(playZone.maxY);
  });

  it('dentro del lienzo 720×1280', () => {
    expect(playZone.minX).toBeGreaterThanOrEqual(0);
    expect(playZone.maxX).toBeLessThanOrEqual(BASE_WIDTH);
    expect(playZone.minY).toBeGreaterThanOrEqual(0);
    expect(playZone.maxY).toBeLessThanOrEqual(BASE_HEIGHT);
  });

  it('empieza BAJO la banda del HUD (la niña no tapa contadores)', () => {
    expect(playZone.minY).toBeGreaterThanOrEqual(ACTION_LAYOUT.hudHeight);
  });

  it('acaba SOBRE la línea de calle (la niña no se mete tras los adoquines)', () => {
    expect(ACTION_LAYOUT.groundY).toBe(1060); // STREET_LINE_Y compartido
    expect(playZone.maxY).toBeLessThanOrEqual(ACTION_LAYOUT.groundY);
  });
});

describe('la niña cabe entera (con hitbox +20 %) en cualquier posición de la zona', () => {
  it('tamaño de despliegue positivo', () => {
    expect(girl.width).toBeGreaterThan(0);
    expect(girl.height).toBeGreaterThan(0);
  });

  it('el sprite completo queda dentro del lienzo en los 4 extremos de la zona', () => {
    const halfW = girl.width / 2;
    const halfH = girl.height / 2;
    expect(playZone.minX - halfW).toBeGreaterThanOrEqual(0);
    expect(playZone.maxX + halfW).toBeLessThanOrEqual(BASE_WIDTH);
    expect(playZone.minY - halfH).toBeGreaterThanOrEqual(ACTION_LAYOUT.hudHeight);
    expect(playZone.maxY + halfH).toBeLessThanOrEqual(BASE_HEIGHT);
  });

  it('incluso la HITBOX expandida (+20 %) no sale del lienzo', () => {
    const halfW = (girl.width * DEFAULT_HITBOX_EXPANSION) / 2;
    const halfH = (girl.height * DEFAULT_HITBOX_EXPANSION) / 2;
    expect(playZone.minX - halfW).toBeGreaterThanOrEqual(0);
    expect(playZone.maxX + halfW).toBeLessThanOrEqual(BASE_WIDTH);
    expect(playZone.minY - halfH).toBeGreaterThanOrEqual(0);
    expect(playZone.maxY + halfH).toBeLessThanOrEqual(BASE_HEIGHT);
  });

  it('el sprite cabe de sobra dentro del ancho de la zona', () => {
    expect(girl.width).toBeLessThanOrEqual(playZone.maxX - playZone.minX);
  });
});

describe('elementos del HUD dentro de la banda superior y del lienzo', () => {
  it('todos los elementos viven en la banda del HUD (y < hudHeight)', () => {
    for (const [name, pos] of Object.entries(hud)) {
      expect(pos.y, `hud.${name}.y`).toBeLessThan(ACTION_LAYOUT.hudHeight);
      expect(pos.y, `hud.${name}.y`).toBeGreaterThan(0);
      expect(pos.x, `hud.${name}.x`).toBeGreaterThanOrEqual(0);
      expect(pos.x, `hud.${name}.x`).toBeLessThanOrEqual(BASE_WIDTH);
    }
  });

  it('la barra del timer + los segundos no se salen por la derecha', () => {
    expect(hud.timerBar.x + hud.timerBar.width).toBeLessThanOrEqual(BASE_WIDTH);
    expect(hud.timerBar.x + hud.timerBar.width).toBeLessThan(hud.timerSeconds.x);
    expect(hud.timerSeconds.x).toBeLessThanOrEqual(BASE_WIDTH - 40);
  });

  it('hudHeight deja zona de juego holgada (el callejón es la mayoría)', () => {
    expect(ACTION_LAYOUT.hudHeight).toBeLessThan(BASE_HEIGHT / 3);
  });
});

describe('depths — la niebla nunca tapa la UI (SPEC §9)', () => {
  it('orden: girl < effects < feedback < hud < overlay', () => {
    expect(depths.girl).toBeLessThan(depths.effects);
    expect(depths.effects).toBeLessThan(depths.feedback);
    expect(depths.feedback).toBeLessThan(depths.hud);
    expect(depths.hud).toBeLessThan(depths.overlay);
  });

  it('TODAS las capas parallax quedan por DEBAJO de la niña', () => {
    for (const layer of ACTION_PARALLAX_LAYERS) {
      expect(layer.depth, `capa ${layer.key}`).toBeLessThan(depths.girl);
    }
  });

  it('TODAS las capas parallax quedan por DEBAJO del HUD', () => {
    for (const layer of ACTION_PARALLAX_LAYERS) {
      expect(layer.depth, `capa ${layer.key}`).toBeLessThan(depths.hud);
    }
  });
});

describe('ACTION_PARALLAX_LAYERS — composición del callejón (SPEC §4.2)', () => {
  it('tiene las 3 capas exigidas: edificios + niebla media + niebla frontal (+ farolas)', () => {
    const keys = ACTION_PARALLAX_LAYERS.map((layer) => layer.key);
    expect(keys).toContain('building');
    expect(keys.filter((key) => key === 'fog').length).toBeGreaterThanOrEqual(3); // lejos+media+frontal
    expect(keys).toContain('lamp-post');
  });

  it('depths únicos y ordenados (lejos → cerca)', () => {
    const depthsList = ACTION_PARALLAX_LAYERS.map((layer) => layer.depth);
    expect(new Set(depthsList).size).toBe(depthsList.length);
    expect([...depthsList].sort((a, b) => a - b)).toEqual(depthsList);
  });

  it('presupuesto de niebla ≤ 30 (SPEC §10.4): capas + pool de puffs', () => {
    const fogSlots = ACTION_PARALLAX_LAYERS
      .filter((layer) => layer.key === 'fog')
      .reduce((sum, layer) => sum + layer.slots.length, 0);
    expect(fogSlots).toBeGreaterThanOrEqual(3);
    expect(fogSlots + PUFF_POOL_SIZE).toBeLessThanOrEqual(MAX_FOG_SPRITES);
    expect(PUFF_POOL_SIZE).toBeLessThanOrEqual(MAX_FOG_SPRITES);
  });

  it('los slots caen dentro del lienzo (con holgura de deriva)', () => {
    for (const layer of ACTION_PARALLAX_LAYERS) {
      for (const slot of layer.slots) {
        expect(slot.y).toBeGreaterThanOrEqual(0);
        expect(slot.y).toBeLessThanOrEqual(BASE_HEIGHT);
        expect(slot.x - layer.drift.amplitude).toBeLessThan(BASE_WIDTH);
        expect(slot.x + layer.drift.amplitude).toBeGreaterThan(0);
      }
    }
  });

  it('alfas de niebla tenues (≤ 0.3): la zona de juego sigue legible', () => {
    for (const layer of ACTION_PARALLAX_LAYERS.filter((l) => l.key === 'fog')) {
      expect(layer.alpha).toBeGreaterThan(0);
      expect(layer.alpha).toBeLessThanOrEqual(0.3);
    }
  });
});

describe('botón pausa (SPEC §6: vuelve a Menu guardando progreso)', () => {
  it('etiqueta «Pausa»', () => {
    expect(ACTION_PAUSE_BUTTON.label).toBe('Pausa');
  });

  it('altura táctil ≥ 64 px (SPEC §9)', () => {
    expect(ACTION_PAUSE_BUTTON.layout.height).toBeGreaterThanOrEqual(MIN_TOUCH_HEIGHT);
  });

  it('colores desde la paleta', () => {
    const paletteValues = new Set(Object.values(PALETTE));
    for (const state of Object.values(ACTION_PAUSE_BUTTON.layout.states)) {
      expect(paletteValues.has(state.fill)).toBe(true);
      expect(paletteValues.has(state.stroke)).toBe(true);
      expect(paletteValues.has(state.text)).toBe(true);
    }
  });
});

describe('feedback del tap (SPEC §4.2/§7.2)', () => {
  it('micro-shake ≤ 150 ms y suave (intensidad < 1 % del viewport)', () => {
    expect(ACTION_FEEDBACK.shakeMs).toBeLessThanOrEqual(150);
    expect(ACTION_FEEDBACK.shakeIntensity).toBeLessThan(0.01);
  });

  it('timings positivos (flash, flotantes, puff, susto, huida)', () => {
    for (const [name, ms] of Object.entries(ACTION_FEEDBACK)) {
      expect(ms, `ACTION_FEEDBACK.${name}`).toBeGreaterThan(0);
    }
  });

  it('la huida da tiempo a verse ANTES de arrancar el QUIZ', () => {
    expect(ACTION_FEEDBACK.exitDelayMs).toBeGreaterThanOrEqual(ACTION_FEEDBACK.fleeMs);
  });

  it('estilos flotantes con colores de la paleta (fuego/éxito)', () => {
    expect(ACTION_LAYOUT.hudTextStyle.color).toBe(textPrimary);
    expect(ACTION_LAYOUT.timerColors.fill).toBe(lampFire);
    expect(ACTION_LAYOUT.timerColors.critical).toBe(error);
    expect(ACTION_LAYOUT.timerColors.track).toBe(parchmentDark);
    expect(FPS_DEBUG_STYLE.color).toBeDefined();
  });

  it('bob/tilt barato y sutil (±4 px, ≤ 0.05 rad)', () => {
    expect(GIRL_WALK_BOB.amplitudePx).toBeLessThanOrEqual(6);
    expect(GIRL_WALK_BOB.tiltRad).toBeLessThanOrEqual(0.05);
  });

  it('cap de dt razonable (un stall no devora el timer de golpe)', () => {
    expect(ACTION_DT_CAP_MS).toBeGreaterThan(0);
    expect(ACTION_DT_CAP_MS).toBeLessThanOrEqual(250);
  });
});

// ---------------------------------------------------------------------------
// Fase 3 — datos nuevos del multi-nivel: tamaños por objetivo, fondos por
// mecánica, props del laboratorio y depths ampliados.
// ---------------------------------------------------------------------------
import {
  ACTION_BACKGROUNDS,
  ACTION_LAB_PROPS,
  ACTION_TARGET_SIZES,
} from '../gameplay/actionLayout';
import { LAB_PARALLAX_LAYERS } from '../art/parallax';

describe('ACTION_TARGET_SIZES — despliegue por objetivo (N1/N2/N3)', () => {
  it('las cuatro formas existen con tamaños positivos', () => {
    for (const size of Object.values(ACTION_TARGET_SIZES)) {
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    }
  });

  it('TODAS mantienen el mínimo táctil ≥ 64 px con su hitbox +20 % (SPEC §9)', () => {
    for (const size of Object.values(ACTION_TARGET_SIZES)) {
      expect(size.width * DEFAULT_HITBOX_EXPANSION).toBeGreaterThanOrEqual(64);
      expect(size.height * DEFAULT_HITBOX_EXPANSION).toBeGreaterThanOrEqual(64);
    }
  });

  it('el sprite completo queda dentro del lienzo en los extremos de la zona', () => {
    const { playZone } = ACTION_LAYOUT;
    for (const size of Object.values(ACTION_TARGET_SIZES)) {
      expect(playZone.minX - size.width / 2).toBeGreaterThanOrEqual(0);
      expect(playZone.maxX + size.width / 2).toBeLessThanOrEqual(720);
      expect(playZone.minY - size.height / 2).toBeGreaterThanOrEqual(0);
      expect(playZone.maxY + size.height / 2).toBeLessThanOrEqual(1280);
    }
  });

  it('la niña (N1) comparte tamaño con la tabla histórica', () => {
    expect(ACTION_TARGET_SIZES.girl).toEqual(ACTION_LAYOUT.girl);
  });
});

describe('ACTION_BACKGROUNDS — fondo por mecánica (Fase 3)', () => {
  it('cubre EXACTAMENTE las tres mecánicas de la unión ActionConfig', () => {
    expect(Object.keys(ACTION_BACKGROUNDS).sort()).toEqual(
      ['cane-strike', 'tap-target', 'transform-target'],
    );
  });

  it('N1/N2 comparten el callejón; N3 usa el laboratorio', () => {
    expect(ACTION_BACKGROUNDS['tap-target'].layers).toBe(ACTION_PARALLAX_LAYERS);
    expect(ACTION_BACKGROUNDS['cane-strike'].layers).toBe(ACTION_PARALLAX_LAYERS);
    expect(ACTION_BACKGROUNDS['transform-target'].layers).toBe(LAB_PARALLAX_LAYERS);
  });

  it('solo el N2 añade estrellas; el lab no tiene cielo', () => {
    expect(ACTION_BACKGROUNDS['tap-target'].stars).toBe(false);
    expect(ACTION_BACKGROUNDS['cane-strike'].stars).toBe(true);
    expect(ACTION_BACKGROUNDS['transform-target'].stars).toBe(false);
  });
});

describe('ACTION_LAB_PROPS — el asedio (N3)', () => {
  it('la puerta cabe centrada y apoya en la línea de suelo', () => {
    const door = ACTION_LAB_PROPS.door;
    expect(door.x).toBe(720 / 2);
    expect(door.y + door.height / 2).toBeLessThanOrEqual(ACTION_LAYOUT.groundY + 4);
  });

  it('Poole y Utterson apoyan en el suelo, a los lados de la puerta', () => {
    const { poole, utterson, door } = ACTION_LAB_PROPS;
    for (const knocker of [poole, utterson]) {
      expect(knocker.y + knocker.height / 2).toBeLessThanOrEqual(ACTION_LAYOUT.groundY + 8);
    }
    expect(poole.x + poole.width / 2).toBeLessThan(door.x - door.width / 2);
    expect(utterson.x - utterson.width / 2).toBeGreaterThan(door.x + door.width / 2);
  });
});

describe('depths ampliados (Fase 3) — el orden de pintado sigue sano', () => {
  it('props y aura quedan DEBAJO del objetivo; la línea de victoria bajo el overlay', () => {
    const { depths } = ACTION_LAYOUT;
    expect(depths.props).toBeLessThan(depths.girl);
    expect(depths.aura).toBeLessThan(depths.girl);
    expect(depths.aura).toBeGreaterThan(1); // sobre las capas parallax
    expect(depths.victory).toBeGreaterThan(depths.feedback);
    expect(depths.victory).toBeLessThan(depths.overlay);
  });
});
