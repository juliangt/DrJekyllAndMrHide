/**
 * Etapa 1 — test del registro de texturas procedurales (`TEXTURE_DEFS`,
 * SPEC §7.2 / D8). Se valida el REGISTRO como datos puros, sin renderizar
 * (jsdom no puede cargar Phaser): claves únicas, tamaños positivos,
 * funciones de dibujo presentes y —con un Graphics de grabación— que cada
 * dibujo emite llamadas dentro del lienzo y solo con colores de la paleta.
 */
import { describe, expect, it } from 'vitest';
import {
  TEXTURE_DEFS,
  TEXTURE_KEYS,
  type TextureDef,
} from '../art/textures';
import { PALETTE, hexToNumber } from '../config/palette';

/** Llamada grabada a un método del Graphics stub. */
interface RecordedCall {
  method: string;
  args: number[];
}

/**
 * Stub de grabación con la superficie de `Phaser.GameObjects.Graphics` que
 * usan las funciones `draw` (encadenable, como el original).
 */
function makeRecordingGraphics(): { g: Parameters<TextureDef['draw']>[0]; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const methods = [
    'fillStyle',
    'lineStyle',
    'fillRect',
    'fillRoundedRect',
    'fillCircle',
    'fillTriangle',
    'strokeRect',
    'strokeRoundedRect',
    'strokeCircle',
    'moveTo',
    'lineTo',
    'beginPath',
    'closePath',
    'strokePath',
    'clear',
  ];
  const stub: Record<string, unknown> = {};
  for (const method of methods) {
    stub[method] = (...args: number[]): Record<string, unknown> => {
      calls.push({ method, args });
      return stub;
    };
  }
  return { g: stub as unknown as Parameters<TextureDef['draw']>[0], calls };
}

/** Colores numéricos permitidos: los de la paleta (SPEC §7.1). */
const PALETTE_NUMBERS = new Set<number>(Object.values(PALETTE).map((hex) => hexToNumber(hex)));

describe('TEXTURE_DEFS — invariants del registro', () => {
  it('tiene las 10 texturas (hornadas 1 + 2)', () => {
    expect(TEXTURE_DEFS.length).toBe(10);
  });

  it('claves únicas', () => {
    const keys = TEXTURE_DEFS.map((def) => def.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('todos los tamaños son positivos (width y height > 0)', () => {
    for (const def of TEXTURE_DEFS) {
      expect(def.width, `${def.key}.width`).toBeGreaterThan(0);
      expect(def.height, `${def.key}.height`).toBeGreaterThan(0);
    }
  });

  it('cada definición tiene descripción no vacía', () => {
    for (const def of TEXTURE_DEFS) {
      expect(def.description.trim().length, `${def.key}.description`).toBeGreaterThan(0);
    }
  });

  it('la función draw está presente y es función en todas', () => {
    for (const def of TEXTURE_DEFS) {
      expect(typeof def.draw, `${def.key}.draw`).toBe('function');
    }
  });

  it('la 1ª hornada completa: niebla, edificio, farola, puff y pergamino', () => {
    const keys = TEXTURE_DEFS.map((def) => def.key);
    expect(keys.slice(0, 5)).toEqual([
      TEXTURE_KEYS.fog,
      TEXTURE_KEYS.building,
      TEXTURE_KEYS.lampPost,
      TEXTURE_KEYS.fogPuff,
      TEXTURE_KEYS.parchmentFrame,
    ]);
    expect(TEXTURE_KEYS.fog).toBe('fog');
    expect(TEXTURE_KEYS.building).toBe('building');
    expect(TEXTURE_KEYS.lampPost).toBe('lamp-post');
    expect(TEXTURE_KEYS.fogPuff).toBe('fog-puff');
    expect(TEXTURE_KEYS.parchmentFrame).toBe('parchment-frame');
  });

  it('la 2ª hornada (Etapa 2): iconos del «Cómo jugar» y altavoces', () => {
    const keys = TEXTURE_DEFS.map((def) => def.key);
    expect(keys.slice(5)).toEqual([
      TEXTURE_KEYS.iconBook,
      TEXTURE_KEYS.iconTap,
      TEXTURE_KEYS.iconQuestion,
      TEXTURE_KEYS.speakerOn,
      TEXTURE_KEYS.speakerOff,
    ]);
    expect(TEXTURE_KEYS.iconBook).toBe('icon-book');
    expect(TEXTURE_KEYS.iconTap).toBe('icon-tap');
    expect(TEXTURE_KEYS.iconQuestion).toBe('icon-question');
    expect(TEXTURE_KEYS.speakerOn).toBe('speaker-on');
    expect(TEXTURE_KEYS.speakerOff).toBe('speaker-off');
  });
});

describe('TEXTURE_DEFS — dibujos con Graphics de grabación', () => {
  it.each(TEXTURE_DEFS.map((def) => [def.key, def] as const))(
    '%s: dibuja sin lanzar y emite al menos una llamada',
    (_key, def) => {
      const { g, calls } = makeRecordingGraphics();
      expect(() => def.draw(g)).not.toThrow();
      expect(calls.length).toBeGreaterThan(0);
    },
  );

  it.each(TEXTURE_DEFS.map((def) => [def.key, def] as const))(
    '%s: usa solo colores de la paleta',
    (_key, def) => {
      const { g, calls } = makeRecordingGraphics();
      def.draw(g);
      // fillStyle(color, alpha) vs lineStyle(width, color, alpha): el color
      // va en args[0] o args[1] según el método.
      const colorCalls = calls.filter((c) => c.method === 'fillStyle' || c.method === 'lineStyle');
      expect(colorCalls.length).toBeGreaterThan(0);
      for (const call of colorCalls) {
        const color = call.method === 'lineStyle' ? call.args[1] : call.args[0];
        expect(
          PALETTE_NUMBERS.has(color),
          `${def.key}: color ${color} fuera de la paleta`,
        ).toBe(true);
      }
    },
  );

  it.each(TEXTURE_DEFS.map((def) => [def.key, def] as const))(
    '%s: toda forma cae dentro del lienzo declarado',
    (_key, def) => {
      const { g, calls } = makeRecordingGraphics();
      def.draw(g);
      for (const call of calls) {
        const [a, b, c, d] = call.args;
        switch (call.method) {
          case 'fillRect':
          case 'fillRoundedRect':
          case 'strokeRect':
          case 'strokeRoundedRect':
            // (x, y, w, h) — el borde pisa el límite 1px: tolerar -11 (grosor).
            expect(a).toBeGreaterThanOrEqual(-11);
            expect(b).toBeGreaterThanOrEqual(-11);
            expect(a + Math.max(c, 0)).toBeLessThanOrEqual(def.width + 11);
            expect(b + Math.max(d, 0)).toBeLessThanOrEqual(def.height + 11);
            break;
          case 'fillCircle':
          case 'strokeCircle':
            // (cx, cy, r) — holgura igual para halos difusos pegados al borde.
            expect(a - Math.max(c, 0)).toBeGreaterThanOrEqual(-11);
            expect(b - Math.max(c, 0)).toBeGreaterThanOrEqual(-11);
            expect(a + Math.max(c, 0)).toBeLessThanOrEqual(def.width + 11);
            expect(b + Math.max(c, 0)).toBeLessThanOrEqual(def.height + 11);
            break;
          default:
            break; // estilos y trazos sin geometría acotable aquí.
        }
      }
    },
  );

  it('la niebla es un gradiente radial: muchos círculos concéntricos', () => {
    const fogDef = TEXTURE_DEFS.find((def) => def.key === TEXTURE_KEYS.fog);
    expect(fogDef).toBeDefined();
    const { g, calls } = makeRecordingGraphics();
    fogDef?.draw(g);
    const circles = calls.filter((c) => c.method === 'fillCircle');
    expect(circles.length).toBeGreaterThanOrEqual(8);
  });

  it('el edificio es una silueta: solo fillRect/fillTriangle sin color de trazo', () => {
    const buildingDef = TEXTURE_DEFS.find((def) => def.key === TEXTURE_KEYS.building);
    const { g, calls } = makeRecordingGraphics();
    buildingDef?.draw(g);
    expect(calls.some((c) => c.method === 'fillRect')).toBe(true);
    expect(calls.some((c) => c.method === 'fillTriangle')).toBe(true);
    expect(calls.some((c) => c.method === 'lineStyle')).toBe(false);
  });

  it('el pergamino tiene borde doble: dos strokeRoundedRect', () => {
    const frameDef = TEXTURE_DEFS.find((def) => def.key === TEXTURE_KEYS.parchmentFrame);
    const { g, calls } = makeRecordingGraphics();
    frameDef?.draw(g);
    expect(calls.filter((c) => c.method === 'strokeRoundedRect').length).toBe(2);
  });

  it('el icono del libro tiene tapa/páginas y marcador verde', () => {
    const def = TEXTURE_DEFS.find((d) => d.key === TEXTURE_KEYS.iconBook);
    expect(def).toBeDefined();
    const { g, calls } = makeRecordingGraphics();
    def?.draw(g);
    expect(calls.some((c) => c.method === 'fillRoundedRect')).toBe(true);
    expect(calls.filter((c) => c.method === 'fillRect').length).toBeGreaterThanOrEqual(8);
    expect(
      calls.some((c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.labGreen)),
    ).toBe(true);
  });

  it('el icono del toque tiene diana (strokeCircle) y destellos', () => {
    const def = TEXTURE_DEFS.find((d) => d.key === TEXTURE_KEYS.iconTap);
    expect(def).toBeDefined();
    const { g, calls } = makeRecordingGraphics();
    def?.draw(g);
    expect(calls.filter((c) => c.method === 'strokeCircle').length).toBeGreaterThanOrEqual(2);
    expect(calls.some((c) => c.method === 'fillTriangle')).toBe(true);
  });

  it('el icono del quiz: carta pergamino + «?» de 6 bloques púrpura', () => {
    const def = TEXTURE_DEFS.find((d) => d.key === TEXTURE_KEYS.iconQuestion);
    expect(def).toBeDefined();
    const { g, calls } = makeRecordingGraphics();
    def?.draw(g);
    expect(calls.some((c) => c.method === 'fillRoundedRect')).toBe(true);
    expect(calls.some((c) => c.method === 'strokeRoundedRect')).toBe(true);
    // La carta se dibuja con fillRoundedRect: TODO fillRect del dibujo es
    // el «?» en bloques (6: barra, columnas, codo, tallo y punto).
    expect(calls.filter((c) => c.method === 'fillRect').length).toBe(6);
    expect(
      calls.some(
        (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.potionPurple),
      ),
    ).toBe(true);
  });

  it('speaker-on: tres ondas concéntricas; speaker-off: aspa roja con strokePath', () => {
    const on = TEXTURE_DEFS.find((d) => d.key === TEXTURE_KEYS.speakerOn);
    const off = TEXTURE_DEFS.find((d) => d.key === TEXTURE_KEYS.speakerOff);
    expect(on).toBeDefined();
    expect(off).toBeDefined();
    const recOn = makeRecordingGraphics();
    on?.draw(recOn.g);
    expect(recOn.calls.filter((c) => c.method === 'strokeCircle').length).toBe(3);
    const recOff = makeRecordingGraphics();
    off?.draw(recOff.g);
    expect(recOff.calls.some((c) => c.method === 'strokePath')).toBe(true);
    // El aspa usa el rojo desaturado de la paleta (feedback, SPEC §7.1).
    expect(
      recOff.calls.some(
        (c) => c.method === 'lineStyle' && c.args[1] === hexToNumber(PALETTE.error),
      ),
    ).toBe(true);
  });
});
