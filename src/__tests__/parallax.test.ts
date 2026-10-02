/**
 * Etapa 2 — test del parallax de niebla en deriva (`src/art/parallax.ts`):
 * `driftOffset` pura (determinista, acotada, periodo correcto) y la tabla
 * `MENU_PARALLAX_LAYERS` como datos válidos (texturas registradas, alfas,
 * parámetros finitos) que consume MenuScene.
 */
import { describe, expect, it } from 'vitest';
import {
  MENU_PARALLAX_LAYERS,
  STREET_LINE_Y,
  driftOffset,
  lampFlicker,
  slotDrift,
  type DriftParams,
} from '../art/parallax';
import { TEXTURE_KEYS } from '../art/textures';
import { PALETTE } from '../config/palette';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';

describe('driftOffset — deriva sinusoidal pura', () => {
  const params: DriftParams = { speed: 0.5, amplitude: 40, phase: 1 };

  it('está acotada en ±amplitude para todo t', () => {
    for (let t = 0; t < 100; t += 0.37) {
      const offset = driftOffset(t, params);
      expect(Math.abs(offset)).toBeLessThanOrEqual(params.amplitude + 1e-9);
    }
  });

  it('alcanza el extremo: |offset| llega a amplitude en algún punto', () => {
    // sin alcanza ±1: para phase=0, t=π/(2·speed) da exactamente amplitude.
    const noPhase: DriftParams = { speed: 0.5, amplitude: 40, phase: 0 };
    expect(driftOffset(Math.PI / (2 * noPhase.speed), noPhase)).toBeCloseTo(40, 6);
    expect(driftOffset((3 * Math.PI) / (2 * noPhase.speed), noPhase)).toBeCloseTo(-40, 6);
  });

  it('periodo correcto: T = 2π/speed (el patrón se repite)', () => {
    const period = (2 * Math.PI) / params.speed;
    for (let t = 0; t < 20; t += 1.3) {
      expect(driftOffset(t + period, params)).toBeCloseTo(driftOffset(t, params), 6);
    }
  });

  it('determinista: misma llamada, mismo resultado', () => {
    expect(driftOffset(3.21, params)).toBe(driftOffset(3.21, params));
  });

  it('responde a cada parámetro (amplitud escala, fase desplaza)', () => {
    const double = driftOffset(2, { ...params, amplitude: 80 });
    expect(double).toBeCloseTo(driftOffset(2, params) * 2, 6);
    const shifted = driftOffset(2, { ...params, phase: params.phase + Math.PI });
    expect(shifted).toBeCloseTo(-driftOffset(2, params), 6);
  });
});

describe('MENU_PARALLAX_LAYERS — la tabla del fondo del menú', () => {
  it('hay capas y están ordenadas por profundidad (lejos → cerca)', () => {
    expect(MENU_PARALLAX_LAYERS.length).toBeGreaterThanOrEqual(4);
    const depths = MENU_PARALLAX_LAYERS.map((layer) => layer.depth);
    const sorted = [...depths].sort((a, b) => a - b);
    expect(depths).toEqual(sorted);
    expect(new Set(depths).size).toBe(depths.length); // sin empates
  });

  it('cada capa usa una textura registrada', () => {
    const registered: Set<string> = new Set(Object.values(TEXTURE_KEYS));
    for (const layer of MENU_PARALLAX_LAYERS) {
      expect(registered.has(layer.key), `${layer.key} no está en TEXTURE_KEYS`).toBe(true);
    }
  });

  it('hay niebla en varias capas (parallax de niebla, SPEC §7.2)', () => {
    const fogLayers = MENU_PARALLAX_LAYERS.filter((layer) => layer.key === TEXTURE_KEYS.fog);
    expect(fogLayers.length).toBeGreaterThanOrEqual(3);
  });

  it('alfas válidas: 0 < alpha ≤ 1 (la niebla es tenue, no opaca)', () => {
    for (const layer of MENU_PARALLAX_LAYERS) {
      expect(layer.alpha, `${layer.key}`).toBeGreaterThan(0);
      expect(layer.alpha, `${layer.key}`).toBeLessThanOrEqual(1);
    }
    for (const fog of MENU_PARALLAX_LAYERS.filter((l) => l.key === TEXTURE_KEYS.fog)) {
      expect(fog.alpha).toBeLessThanOrEqual(0.3);
    }
  });

  it('derivas finitas con amplitud ≥ 0 y velocidad > 0', () => {
    for (const layer of MENU_PARALLAX_LAYERS) {
      const { speed, amplitude, phase } = layer.drift;
      expect(Number.isFinite(speed), `${layer.key}.speed`).toBe(true);
      expect(speed, `${layer.key}.speed`).toBeGreaterThan(0);
      expect(amplitude, `${layer.key}.amplitude`).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(phase), `${layer.key}.phase`).toBe(true);
    }
  });

  it('los slots caen dentro del lienzo base (con holgura de deriva)', () => {
    for (const layer of MENU_PARALLAX_LAYERS) {
      for (const slot of layer.slots) {
        const minX = slot.x - layer.drift.amplitude;
        const maxX = slot.x + layer.drift.amplitude;
        // Los sprites de niebla/edificios sangran deliberadamente por los
        // bordes laterales (composición), pero el CENTRO queda en el lienzo.
        expect(slot.y).toBeGreaterThanOrEqual(0);
        expect(slot.y).toBeLessThanOrEqual(BASE_HEIGHT);
        expect(minX).toBeLessThan(BASE_WIDTH);
        expect(maxX).toBeGreaterThan(0);
        expect(slot.scale).toBeGreaterThan(0);
      }
    }
  });

  it('el tinte, si existe, es de la paleta', () => {
    const paletteValues = new Set(Object.values(PALETTE));
    for (const layer of MENU_PARALLAX_LAYERS) {
      if (layer.tint) {
        expect(paletteValues.has(layer.tint), `${layer.key}.tint=${layer.tint}`).toBe(true);
      }
    }
  });

  it('slotDrift combina la fase de la capa con el desfase del slot', () => {
    const layer = MENU_PARALLAX_LAYERS[0];
    const slot = layer.slots[0];
    const drift = slotDrift(layer, slot);
    expect(drift.speed).toBe(layer.drift.speed);
    expect(drift.amplitude).toBe(layer.drift.amplitude);
    expect(drift.phase).toBeCloseTo(layer.drift.phase + slot.phaseOffset, 6);
  });
});

describe('lampFlicker — parpadeo determinista de farolas (SPEC §7.2)', () => {
  it('acotado en [0, 1]', () => {
    for (let t = 0; t < 50; t += 0.11) {
      const alpha = lampFlicker(t);
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(1);
    }
  });

  it('determinista y oscila (no clavada en un valor)', () => {
    const values = new Set<number>();
    for (let t = 0; t < 10; t += 0.05) {
      values.add(lampFlicker(t));
    }
    expect(values.size).toBeGreaterThan(5);
  });
});

describe('STREET_LINE_Y — composición', () => {
  it('la línea de calle cae en el tercio inferior del lienzo vertical', () => {
    expect(STREET_LINE_Y).toBeGreaterThan(BASE_HEIGHT * 0.7);
    expect(STREET_LINE_Y).toBeLessThan(BASE_HEIGHT);
  });
});
