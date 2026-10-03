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
  it('tiene las 19 texturas (hornadas 1 + 2 + 3 + 4 + 5 + intro + navegación + cielo)', () => {
    expect(TEXTURE_DEFS.length).toBe(19);
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
    expect(keys.slice(5, 10)).toEqual([
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

  it('la 3ª hornada (Etapa 3): mesa y frasco del laboratorio narrativo', () => {
    const keys = TEXTURE_DEFS.map((def) => def.key);
    expect(keys.slice(10, 12)).toEqual([TEXTURE_KEYS.labBench, TEXTURE_KEYS.labFlask]);
    expect(TEXTURE_KEYS.labBench).toBe('lab-bench');
    expect(TEXTURE_KEYS.labFlask).toBe('lab-flask');
  });

  it('la 4ª hornada (Etapa 4): la niña del minijuego', () => {
    const keys = TEXTURE_DEFS.map((def) => def.key);
    expect(keys.slice(12, 13)).toEqual([TEXTURE_KEYS.girl]);
    expect(TEXTURE_KEYS.girl).toBe('girl');
  });

  it('la 5ª hornada (Etapa 6): sello de cera púrpura del diploma', () => {
    const keys = TEXTURE_DEFS.map((def) => def.key);
    expect(keys.slice(13, 14)).toEqual([TEXTURE_KEYS.waxSeal]);
    expect(TEXTURE_KEYS.waxSeal).toBe('wax-seal');
  });

  it('la 6ª hornada (intro pre-nivel): Jekyll, Hyde y el brazo articulado', () => {
    const keys = TEXTURE_DEFS.map((def) => def.key);
    // Las texturas nuevas se añadieron AL FINAL del registro (los slices por
    // índice de las hornadas 1–5 siguen intactos).
    expect(keys.slice(14, 15)).toEqual([TEXTURE_KEYS.jekyll]);
    expect(keys.slice(15, 16)).toEqual([TEXTURE_KEYS.hyde]);
    expect(keys.slice(16, 17)).toEqual([TEXTURE_KEYS.hydeArm]);
    expect(TEXTURE_KEYS.jekyll).toBe('jekyll');
    expect(TEXTURE_KEYS.hyde).toBe('hyde');
    expect(TEXTURE_KEYS.hydeArm).toBe('hyde-arm');
  });

  it('la 7ª hornada (navegación y cielo): la flecha del costado y la estrella', () => {
    const keys = TEXTURE_DEFS.map((def) => def.key);
    expect(keys.slice(17)).toEqual([TEXTURE_KEYS.arrow, TEXTURE_KEYS.star]);
    expect(TEXTURE_KEYS.arrow).toBe('arrow');
    expect(TEXTURE_KEYS.star).toBe('star');
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

  it('la mesa del laboratorio: tablero + patas (fillRect) y reflejo de farola', () => {
    const def = TEXTURE_DEFS.find((d) => d.key === TEXTURE_KEYS.labBench);
    expect(def).toBeDefined();
    const { g, calls } = makeRecordingGraphics();
    def?.draw(g);
    expect(calls.filter((c) => c.method === 'fillRect').length).toBeGreaterThanOrEqual(5);
    // El reflejo tenue del tablero usa el fuego de farola de la paleta.
    expect(
      calls.some(
        (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.lampFire),
      ),
    ).toBe(true);
  });

  it('el frasco: halo de brillo (círculos), líquido (triángulo) y vidrio (strokePath)', () => {
    const def = TEXTURE_DEFS.find((d) => d.key === TEXTURE_KEYS.labFlask);
    expect(def).toBeDefined();
    const { g, calls } = makeRecordingGraphics();
    def?.draw(g);
    expect(calls.filter((c) => c.method === 'fillCircle').length).toBeGreaterThanOrEqual(3);
    expect(calls.some((c) => c.method === 'fillTriangle')).toBe(true);
    expect(calls.some((c) => c.method === 'strokePath')).toBe(true);
    // El líquido/base es NEUTRO (pergamino claro): el tinte del prop lo colorea.
    expect(
      calls.some(
        (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.parchmentLight),
      ),
    ).toBe(true);
  });

  it('la niña (Etapa 4): silueta + farol con doble halo de fuego', () => {
    const def = TEXTURE_DEFS.find((d) => d.key === TEXTURE_KEYS.girl);
    expect(def).toBeDefined();
    const { g, calls } = makeRecordingGraphics();
    def?.draw(g);
    // Silueta: cabeza + moños (círculos), torso/falda/brazo (triángulos),
    // piernas/botas y jaula del farol (rects).
    expect(calls.filter((c) => c.method === 'fillCircle').length).toBeGreaterThanOrEqual(6);
    expect(calls.filter((c) => c.method === 'fillTriangle').length).toBeGreaterThanOrEqual(4);
    expect(calls.filter((c) => c.method === 'fillRect').length).toBeGreaterThanOrEqual(9);
    // El farol es el punto focal: 2 halos + núcleo en fuego de farola.
    expect(
      calls.filter((c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.lampFire))
        .length,
    ).toBeGreaterThanOrEqual(3);
    // La silueta usa fogFar: un tono MÁS CLARO que los edificios para que la
    // niña se recorte de la noche (contraste, feedback visual del jugador).
    expect(
      calls.some(
        (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.fogFar),
      ),
    ).toBe(true);
    expect(
      calls.some(
        (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.buildings),
      ),
    ).toBe(false);
  });

  it('el sello de cera (Etapa 6): disco púrpura irregular + relieve + brillo', () => {
    const def = TEXTURE_DEFS.find((d) => d.key === TEXTURE_KEYS.waxSeal);
    expect(def).toBeDefined();
    const { g, calls } = makeRecordingGraphics();
    def?.draw(g);
    // Disco principal + 8 bultos del rim + sombra + 2 luces: ≥ 10 círculos.
    expect(calls.filter((c) => c.method === 'fillCircle').length).toBeGreaterThanOrEqual(10);
    // La cera es púrpura poción (SPEC §7.1) y el relieve/brillo usan
    // edificios (sombra) y texto principal (brillo).
    expect(
      calls.some(
        (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.potionPurple),
      ),
    ).toBe(true);
    expect(
      calls.some(
        (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.buildings),
      ),
    ).toBe(true);
    expect(
      calls.some(
        (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.textPrimary),
      ),
    ).toBe(true);
    // Relieve grabado: anillo circunscrito (strokeCircle) + frasco (fillRect).
    expect(calls.some((c) => c.method === 'strokeCircle')).toBe(true);
    expect(calls.some((c) => c.method === 'fillRect')).toBe(true);
    // El brillo de la cera son DOS luces concéntricas de distinta intensidad.
    const shineCalls = calls.filter(
      (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.textPrimary),
    );
    expect(shineCalls.length).toBe(2);
    expect(shineCalls[0].args[1]).not.toBe(shineCalls[1].args[1]); // alfas distintos
  });

  it('jekyll (intro): bata clara, copa y matraz con la fórmula verde', () => {
    const def = TEXTURE_DEFS.find((d) => d.key === TEXTURE_KEYS.jekyll);
    expect(def).toBeDefined();
    const { g, calls } = makeRecordingGraphics();
    def?.draw(g);
    // Bata CLARA de laboratorio (el «antes» elegante de la transformación).
    expect(
      calls.some(
        (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.parchmentLight),
      ),
    ).toBe(true);
    // Sombrero, cabeza y piernas: la misma silueta oscura de las farolas/niña.
    expect(
      calls.some(
        (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.buildings),
      ),
    ).toBe(true);
    // La fórmula del matraz es verde laboratorio (resabio de la poción).
    expect(
      calls.some(
        (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.labGreen),
      ),
    ).toBe(true);
    // Contorno de vidrio (strokePath): el mismo lenguaje que `lab-flask`.
    expect(calls.some((c) => c.method === 'strokePath')).toBe(true);
    // Doctor RECTO: torso, sombrero (copa+ala+cinta), botones y piernas.
    expect(calls.filter((c) => c.method === 'fillRect').length).toBeGreaterThanOrEqual(10);
  });

  it('hyde (intro): joroba y garras en silueta, ojo verde y aura púrpura sin sangre', () => {
    const def = TEXTURE_DEFS.find((d) => d.key === TEXTURE_KEYS.hyde);
    expect(def).toBeDefined();
    const { g, calls } = makeRecordingGraphics();
    def?.draw(g);
    // Bestia angulosa: púas de pelo, faldones rotos y garras (triángulos).
    expect(calls.filter((c) => c.method === 'fillTriangle').length).toBeGreaterThanOrEqual(12);
    // Joroba/cuerpo redondeado: círculos solapados (silueta encorvada).
    expect(calls.filter((c) => c.method === 'fillCircle').length).toBeGreaterThanOrEqual(10);
    // Ojo brillante verde con doble halo (mismo lenguaje que los faroles).
    const eyeCalls = calls.filter(
      (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.labGreen),
    );
    expect(eyeCalls.length).toBeGreaterThanOrEqual(2);
    // Resabio de la poción: aura púrpura tenue alrededor de la silueta.
    expect(
      calls.some(
        (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.potionPurple),
      ),
    ).toBe(true);
    // Inquietante pero NO sangriento (10+): ni un trazo del rojo de error.
    expect(
      calls.some(
        (c) => c.method === 'fillStyle' && c.args[0] === hexToNumber(PALETTE.error),
      ),
    ).toBe(false);
  });
});
