/**
 * Fábrica de texturas procedurales (SPEC §7, decisión D8): 100 % del arte se
 * genera en código (`Phaser.GameObjects.Graphics` → `generateTexture`) en
 * `BootScene`. Cero archivos de imagen, cero licencias.
 *
 * DISEÑO DATA-FIRST para testabilidad: el registro `TEXTURE_DEFS` es un
 * array de datos puros (clave única + tamaño + descripción + función de
 * dibujo). Los tests validan el registro SIN renderizar (jsdom no puede
 * cargar Phaser, así que este módulo solo importa Phaser como TIPO; la
 * función `generateTextures` se ejerce en el navegador).
 *
 * Reglas de las funciones `draw`:
 *  - Deterministas (nada de `Math.random()`): la misma textura en cada boot.
 *  - Solo paleta de `config/palette.ts` (vía `hexToNumber`).
 *  - Sin `fillGradientStyle`: la textura generada pasa por Canvas 2D y los
 *    gradientes de Graphics NO se hornean (nota oficial de
 *    `generateTexture`); los degradados se aproximan con capas concéntricas
 *    de alfa decreciente.
 */
import type Phaser from 'phaser';
import {
  buildings,
  fogMid,
  fogNear,
  hexToNumber,
  lampFire,
  parchmentDark,
  parchmentLight,
} from '../config/palette';

/** Definición de una textura procedural (datos puros + función de dibujo). */
export interface TextureDef {
  /** Clave única con la que se registra en el Texture Manager. */
  key: string;
  /** Ancho de la textura en px (> 0). */
  width: number;
  /** Alto de la textura en px (> 0). */
  height: number;
  /** Qué representa y dónde se consume (SPEC §7.2). */
  description: string;
  /** Dibuja la textura en `g` (determinista, con la paleta). */
  draw: (g: Phaser.GameObjects.Graphics) => void;
}

/** Claves planificadas de la primera hornada (SPEC §7.2 / PLAN Etapa 1). */
export const TEXTURE_KEYS = {
  /** Gradiente radial difuso (niebla en capas parallax / puffs grandes). */
  fog: 'fog',
  /** Silueta de edificio (rectángulos irregulares, callejón). */
  building: 'building',
  /** Farola: poste + farol con halo de fuego (flicker por opacidad). */
  lampPost: 'lamp-post',
  /** «Puff» de niebla para el tap fallido (feedback sin castigo, §4.2). */
  fogPuff: 'fog-puff',
  /** Marco pergamino: rectángulo redondeado + borde doble sepia (UI/quiz). */
  parchmentFrame: 'parchment-frame',
} as const;

/**
 * Niebla: gradiente radial difuso. Anillos concéntricos de alfa creciente
 * hacia el centro (aproximación horneable del gradiente radial).
 */
function drawFog(g: Phaser.GameObjects.Graphics): void {
  const cx = 128;
  const cy = 128;
  const maxRadius = 128;
  const steps = 16;
  const color = hexToNumber(fogMid);
  for (let i = steps; i >= 1; i--) {
    const radius = (maxRadius * i) / steps;
    // Alfa pequeña por anillo: se apilan hacia el centro (~0.6 en el núcleo).
    g.fillStyle(color, 0.05);
    g.fillCircle(cx, cy, radius);
  }
  // Núcleo algo más denso para que el sprite «lea» como volumen de niebla.
  g.fillStyle(color, 0.16);
  g.fillCircle(cx, cy, maxRadius / 6);
}

/** Silueta de edificio: rectángulos irregulares (SPEC §7.2), sin ventanas. */
function drawBuilding(g: Phaser.GameObjects.Graphics): void {
  const color = hexToNumber(buildings);
  // Cuerpo central alto.
  g.fillStyle(color, 1);
  g.fillRect(48, 96, 144, 544);
  // Torre lateral izquierda con azotea irregular.
  g.fillStyle(color, 1);
  g.fillRect(8, 160, 64, 480);
  // Torre derecha más baja y saliente (cornisa).
  g.fillStyle(color, 1);
  g.fillRect(184, 240, 56, 400);
  // Remate en cuña del cuerpo central (techo victoriano).
  g.fillTriangle(48, 96, 192, 96, 120, 32);
  // Chimenea.
  g.fillRect(160, 48, 16, 48);
}

/** Farola: poste oscuro + farol de fuego con doble halo (flicker en runtime). */
function drawLampPost(g: Phaser.GameObjects.Graphics): void {
  const iron = hexToNumber(buildings);
  const fire = hexToNumber(lampFire);
  // Halo exterior difuso (la luz que corta la niebla).
  g.fillStyle(fire, 0.16);
  g.fillCircle(48, 64, 40);
  // Halo interior.
  g.fillStyle(fire, 0.28);
  g.fillCircle(48, 64, 24);
  // Núcleo del farol.
  g.fillStyle(fire, 0.95);
  g.fillCircle(48, 64, 12);
  // Jaula/ marco del farol.
  g.fillStyle(iron, 1);
  g.fillRect(32, 44, 32, 4); // techo del farol
  g.fillRect(32, 82, 32, 4); // base del farol
  g.fillRect(30, 48, 4, 34); // barrotes
  g.fillRect(62, 48, 4, 34);
  // Remate superior y cuello.
  g.fillTriangle(30, 44, 66, 44, 48, 24);
  g.fillRect(46, 24, 4, 20);
  // Poste y pie.
  g.fillRect(44, 86, 8, 258);
  g.fillRect(30, 336, 36, 12);
  g.fillRect(24, 348, 48, 12);
}

/** «Puff» de niebla del tap fallido: racimo suave de círculos. */
function drawFogPuff(g: Phaser.GameObjects.Graphics): void {
  const near = hexToNumber(fogNear);
  const mid = hexToNumber(fogMid);
  // Racimo determinista: 6 burbujas alrededor de 1 núcleo.
  const puffs: ReadonlyArray<{ x: number; y: number; r: number; a: number }> = [
    { x: 64, y: 64, r: 26, a: 0.55 },
    { x: 34, y: 52, r: 18, a: 0.4 },
    { x: 94, y: 54, r: 16, a: 0.4 },
    { x: 46, y: 86, r: 15, a: 0.35 },
    { x: 84, y: 88, r: 17, a: 0.35 },
    { x: 64, y: 34, r: 12, a: 0.3 },
    { x: 64, y: 98, r: 11, a: 0.3 },
  ];
  for (const p of puffs) {
    g.fillStyle(mid, p.a);
    g.fillCircle(p.x, p.y, p.r);
  }
  // Toque de la capa cercana (más clara) en el corazón del puff.
  g.fillStyle(near, 0.4);
  g.fillCircle(64, 64, 14);
}

/** Marco pergamino: rectángulo redondeado + borde doble sepia (SPEC §7.2). */
function drawParchmentFrame(g: Phaser.GameObjects.Graphics): void {
  const light = hexToNumber(parchmentLight);
  const dark = hexToNumber(parchmentDark);
  // Superficie pergamino.
  g.fillStyle(light, 1);
  g.fillRoundedRect(0, 0, 512, 512, 24);
  // Borde exterior (grueso) y borde interior (fino): el «borde doble».
  g.lineStyle(10, dark, 1);
  g.strokeRoundedRect(10, 10, 492, 492, 20);
  g.lineStyle(3, dark, 0.85);
  g.strokeRoundedRect(34, 34, 444, 444, 12);
  // Sombra interior suave en el borde superior (envejecido).
  g.fillStyle(dark, 0.08);
  g.fillRect(34, 34, 444, 22);
}

/**
 * Primera hornada de texturas (PLAN Etapa 1). Hornadas futuras (niña, Hyde,
 * adoquines, sello de cera…) se añaden aquí o en registros posteriores.
 */
export const TEXTURE_DEFS: readonly TextureDef[] = [
  {
    key: TEXTURE_KEYS.fog,
    width: 256,
    height: 256,
    description: 'Gradiente radial difuso de niebla (capas parallax, deriva sinusoidal).',
    draw: drawFog,
  },
  {
    key: TEXTURE_KEYS.building,
    width: 240,
    height: 640,
    description: 'Silueta de edificio en callejón (rectángulos irregulares, capa parallax).',
    draw: drawBuilding,
  },
  {
    key: TEXTURE_KEYS.lampPost,
    width: 96,
    height: 360,
    description: 'Farola con farol de fuego y halo (parpadeo por opacidad en runtime).',
    draw: drawLampPost,
  },
  {
    key: TEXTURE_KEYS.fogPuff,
    width: 128,
    height: 128,
    description: 'Puff de niebla del tap fallido (feedback sin castigo, SPEC §4.2).',
    draw: drawFogPuff,
  },
  {
    key: TEXTURE_KEYS.parchmentFrame,
    width: 512,
    height: 512,
    description: 'Marco pergamino con borde doble sepia (paneles de UI y quiz).',
    draw: drawParchmentFrame,
  },
];

/**
 * Recorre `TEXTURE_DEFS` y hornea cada textura en el Texture Manager de la
 * escena (llamar desde `BootScene.create()`). Idempotente: si la clave ya
 * existe (p. ej. reinicio de la escena Boot), se elimina y regenera.
 */
export function generateTextures(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  for (const def of TEXTURE_DEFS) {
    g.clear();
    def.draw(g);
    if (scene.textures.exists(def.key)) {
      scene.textures.remove(def.key);
    }
    g.generateTexture(def.key, def.width, def.height);
  }
  g.destroy();
}
