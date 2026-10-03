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
  error,
  fogMid,
  fogNear,
  hexToNumber,
  labGreen,
  lampFire,
  parchmentDark,
  parchmentLight,
  potionPurple,
  street,
  textPrimary,
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
  /** Icono «Cómo jugar» paso 1: leer la viñeta (libro abierto). */
  iconBook: 'icon-book',
  /** Icono «Cómo jugar» paso 2: tocar al objetivo (dedo + diana). */
  iconTap: 'icon-tap',
  /** Icono «Cómo jugar» paso 3: responder el quiz (carta con «?»). */
  iconQuestion: 'icon-question',
  /** Altavoz con ondas: sonido activado (toggle de mute, SPEC §8). */
  speakerOn: 'speaker-on',
  /** Altavoz con X: silencio (toggle de mute, SPEC §8). */
  speakerOff: 'speaker-off',
  /** Mesa de laboratorio del fondo «lab» (Etapa 3: narrativa, SPEC §7.2). */
  labBench: 'lab-bench',
  /** Matraz Erlenmeyer neutro: se tiñe (verde/púrpura) vía tint del prop. */
  labFlask: 'lab-flask',
  /** La niña: silueta pequeña con farol iluminado (objetivo N1, SPEC §7.2). */
  girl: 'girl',
  /** Sello de cera púrpura del diploma de victoria (Etapa 6, SPEC §6). */
  waxSeal: 'wax-seal',
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

// ---- Iconos de la Etapa 2 («Cómo jugar» + toggle de mute, SPEC §6/§8) --------

/** Libro abierto: paso 1 del «Cómo jugar» (leer la viñeta). */
function drawIconBook(g: Phaser.GameObjects.Graphics): void {
  const cover = hexToNumber(parchmentDark);
  const page = hexToNumber(parchmentLight);
  const ink = hexToNumber(parchmentDark);
  const ribbon = hexToNumber(labGreen);
  // Tapa oscura asomando por detrás de las páginas.
  g.fillStyle(cover, 1);
  g.fillRoundedRect(14, 34, 100, 64, 6);
  // Páginas izquierda y derecha.
  g.fillStyle(page, 1);
  g.fillRect(22, 40, 40, 52);
  g.fillRect(66, 40, 40, 52);
  // Lomo central.
  g.fillStyle(cover, 1);
  g.fillRect(62, 38, 4, 58);
  // Líneas de texto sugeridas (trazos finos sobre el pergamino).
  g.fillStyle(ink, 0.45);
  g.fillRect(28, 48, 28, 3);
  g.fillRect(28, 58, 28, 3);
  g.fillRect(28, 68, 20, 3);
  g.fillRect(72, 48, 28, 3);
  g.fillRect(72, 58, 24, 3);
  g.fillRect(72, 68, 28, 3);
  // Marcador verde colgando en la página derecha.
  g.fillStyle(ribbon, 1);
  g.fillRect(88, 28, 10, 22);
  g.fillTriangle(88, 50, 98, 50, 93, 58);
}

/** Dedo tocando una diana: paso 2 del «Cómo jugar» (tocar al objetivo). */
function drawIconTap(g: Phaser.GameObjects.Graphics): void {
  const finger = hexToNumber(textPrimary);
  const ring = hexToNumber(lampFire);
  // Diana: anillo exterior + eco interior.
  g.lineStyle(6, ring, 0.9);
  g.strokeCircle(64, 76, 34);
  g.lineStyle(4, ring, 0.45);
  g.strokeCircle(64, 76, 20);
  // Dedo (silueta clara): punta, cuerpo y nudillos.
  g.fillStyle(finger, 1);
  g.fillCircle(64, 44, 9);
  g.fillRect(58, 44, 12, 48);
  g.fillRect(46, 92, 36, 22);
  // Destellos del toque (tres chevrones de fuego alrededor de la punta).
  g.fillStyle(ring, 0.95);
  g.fillTriangle(64, 10, 57, 20, 71, 20);
  g.fillTriangle(26, 28, 20, 40, 34, 36);
  g.fillTriangle(102, 28, 108, 40, 94, 36);
}

/** Carta pergamino con «?» en púrpura: paso 3 del «Cómo jugar» (quiz). */
function drawIconQuestion(g: Phaser.GameObjects.Graphics): void {
  const page = hexToNumber(parchmentLight);
  const dark = hexToNumber(parchmentDark);
  const mark = hexToNumber(potionPurple);
  // Carta con borde.
  g.fillStyle(page, 1);
  g.fillRoundedRect(20, 16, 88, 96, 12);
  g.lineStyle(5, dark, 1);
  g.strokeRoundedRect(20, 16, 88, 96, 12);
  // «?» en bloques (determinista, sin fuente): barra, columnas, codo,
  // tallo y punto.
  g.fillStyle(mark, 1);
  g.fillRect(50, 32, 28, 10); // barra superior
  g.fillRect(44, 40, 10, 20); // columna izquierda
  g.fillRect(72, 40, 10, 28); // columna derecha (más larga)
  g.fillRect(56, 62, 20, 10); // codo hacia el centro
  g.fillRect(58, 70, 10, 18); // tallo
  g.fillRect(56, 92, 16, 12); // punto
}

/** Caja + cono del altavoz (compartida por speaker-on / speaker-off). */
function drawSpeakerCone(g: Phaser.GameObjects.Graphics): void {
  const body = hexToNumber(textPrimary);
  // Caja del altavoz.
  g.fillStyle(body, 1);
  g.fillRect(12, 38, 14, 24);
  // Cono (trapecio hacia la derecha, dos triángulos).
  g.fillTriangle(26, 34, 26, 62, 52, 72);
  g.fillTriangle(26, 34, 52, 72, 52, 26);
}

/** Altavoz con ondas de sonido: sonido ACTIVADO (toggle de mute). */
function drawSpeakerOn(g: Phaser.GameObjects.Graphics): void {
  const wave = hexToNumber(textPrimary);
  drawSpeakerCone(g);
  // Tres frentes de onda concéntricos, cada vez más tenues.
  g.lineStyle(5, wave, 0.85);
  g.strokeCircle(54, 48, 14);
  g.lineStyle(5, wave, 0.45);
  g.strokeCircle(54, 48, 26);
  g.lineStyle(5, wave, 0.2);
  g.strokeCircle(54, 48, 38);
}

/** Altavoz con aspa roja desaturada: SILENCIO (toggle de mute). */
function drawSpeakerOff(g: Phaser.GameObjects.Graphics): void {
  const cross = hexToNumber(error);
  drawSpeakerCone(g);
  // Aspa (dos trazos diagonales gruesos).
  g.lineStyle(7, cross, 0.95);
  g.beginPath();
  g.moveTo(52, 34);
  g.lineTo(84, 62);
  g.moveTo(84, 34);
  g.lineTo(52, 62);
  g.strokePath();
}

// ---- Texturas de la Etapa 3 (fondo «lab» de la narrativa, SPEC §4.1/§7.2) ----


/**
 * Mesa de laboratorio (720 px de ancho: ocupa todo el fondo del panel 2).
 * Tablero oscuro con canto, faldón, patas y travesaño; un reflejo tenue de
 * fuego de farola sobre el tablero lo separa del fondo nocturno.
 */
function drawLabBench(g: Phaser.GameObjects.Graphics): void {
  const wood = hexToNumber(buildings);
  const top = hexToNumber(street);
  const apron = hexToNumber(parchmentDark);
  const sheen = hexToNumber(lampFire);
  // Tablero con canto (madera oscura).
  g.fillStyle(top, 1);
  g.fillRect(0, 40, 720, 34);
  g.fillStyle(wood, 1);
  g.fillRect(0, 74, 720, 14);
  // Faldón bajo el tablero.
  g.fillStyle(apron, 1);
  g.fillRect(0, 88, 720, 10);
  // Patas y travesaño.
  g.fillStyle(wood, 1);
  g.fillRect(48, 98, 30, 162);
  g.fillRect(642, 98, 30, 162);
  g.fillRect(48, 170, 624, 14);
  // Reflejo tenue del vidrio/luz sobre el tablero.
  g.fillStyle(sheen, 0.12);
  g.fillRect(0, 40, 720, 6);
}

/**
 * Matraz Erlenmeyer NEUTRO (se tiñe en runtime con `tint`: verde laboratorio
 * o púrpura poción, según el prop de `LORE_BACKGROUNDS`). Doble halo suave
 * (el «brillo» que pulsa en runtime), contorno de vidrio claro, líquido en
 * el cono inferior con burbujas y corcho oscuro.
 */
function drawLabFlask(g: Phaser.GameObjects.Graphics): void {
  const glass = hexToNumber(textPrimary);
  const neutral = hexToNumber(parchmentLight);
  const cork = hexToNumber(parchmentDark);
  // Halos del brillo (el tint del prop los colorea en runtime).
  g.fillStyle(neutral, 0.14);
  g.fillCircle(48, 64, 44);
  g.fillStyle(neutral, 0.2);
  g.fillCircle(48, 70, 30);
  // Líquido: cono inferior (el tint lo vuelve verde/púrpura).
  g.fillStyle(neutral, 0.92);
  g.fillTriangle(30, 96, 66, 96, 48, 70);
  // Burbujas ascendiendo.
  g.fillStyle(neutral, 0.5);
  g.fillCircle(44, 86, 4);
  g.fillCircle(54, 78, 3);
  // Contorno de vidrio: cuello + cono, en un solo trazo.
  g.lineStyle(4, glass, 0.85);
  g.beginPath();
  g.moveTo(40, 10);
  g.lineTo(40, 48);
  g.lineTo(16, 96);
  g.lineTo(80, 96);
  g.lineTo(56, 48);
  g.lineTo(56, 10);
  g.strokePath();
  // Brillo lateral del cuello.
  g.fillStyle(glass, 0.35);
  g.fillRect(42, 14, 4, 30);
  // Corcho.
  g.fillStyle(cork, 1);
  g.fillRect(36, 2, 24, 10);
}

// ---- Texturas de la Etapa 4 (minijuego de acción, SPEC §4.2/§7.2) -----------

/**
 * La niña (objetivo del Nivel 1): silueta pequeña reconocible — cabeza con
 * moños, vestido acampanado, piernas — cuyo punto focal es el FAROL
 * iluminado (doble halo de fuego de farola, el mismo lenguaje de las
 * farolas del callejón). Determinista; la animación de caminar (bob/tilt)
 * es runtime, no parte de la textura.
 */
function drawGirl(g: Phaser.GameObjects.Graphics): void {
  const silhouette = hexToNumber(buildings);
  const fire = hexToNumber(lampFire);

  // Halos del farol (la luz que la hace visible en la niebla) — primero,
  // para que la jaula y la niña piquen encima.
  g.fillStyle(fire, 0.14);
  g.fillCircle(72, 92, 22);
  g.fillStyle(fire, 0.22);
  g.fillCircle(72, 92, 13);

  // Silueta: cabeza + moños.
  g.fillStyle(silhouette, 1);
  g.fillCircle(44, 28, 11);
  g.fillCircle(30, 21, 4);
  g.fillCircle(58, 21, 4);
  // Torso y vestido acampanado (trapecio en dos triángulos).
  g.fillTriangle(37, 41, 51, 41, 44, 82);
  g.fillTriangle(35, 74, 53, 74, 23, 122);
  g.fillTriangle(53, 74, 65, 122, 23, 122);
  // Piernas y botas.
  g.fillRect(37, 122, 6, 30);
  g.fillRect(47, 122, 6, 30);
  g.fillRect(34, 150, 10, 8);
  g.fillRect(46, 150, 10, 8);
  // Brazo extendido hacia el farol.
  g.fillTriangle(50, 48, 69, 67, 54, 74);

  // Farol colgando de la mano: asa, jaula y núcleo de fuego.
  g.fillRect(70, 66, 4, 14); // asa
  g.fillRect(62, 80, 20, 4); // techo del farol
  g.fillRect(62, 100, 20, 4); // base del farol
  g.fillRect(62, 84, 4, 16); // barrote izq
  g.fillRect(78, 84, 4, 16); // barrote der
  g.fillStyle(fire, 0.95);
  g.fillCircle(72, 92, 6); // núcleo
}

// ---- Texturas de la Etapa 6 (diploma de victoria, SPEC §6/§7.2) --------------

/**
 * Sello de cera púrpura del diploma (SPEC §6, acento potionPurple de la
 * paleta): disco con borde IRREGULAR (bultos deterministas alrededor del
 * rim, como cera vertida), sombra interior inferior, anillo y frasco en
 * relieve (tinta oscura, alpha bajo) y brillo de cera (dos luces suaves).
 * Determinista: mismo sello en cada boot.
 */
function drawWaxSeal(g: Phaser.GameObjects.Graphics): void {
  const wax = hexToNumber(potionPurple);
  const shade = hexToNumber(buildings);
  const shine = hexToNumber(textPrimary);

  // Disco principal de cera.
  g.fillStyle(wax, 1);
  g.fillCircle(64, 64, 44);
  // Borde irregular: 8 bultos deterministas alrededor del rim (cera vertida).
  const bumps: ReadonlyArray<{ x: number; y: number; r: number }> = [
    { x: 104, y: 64, r: 8 },
    { x: 92, y: 92, r: 9 },
    { x: 64, y: 104, r: 7 },
    { x: 36, y: 92, r: 9 },
    { x: 24, y: 64, r: 8 },
    { x: 36, y: 36, r: 9 },
    { x: 64, y: 26, r: 7 },
    { x: 92, y: 36, r: 9 },
  ];
  for (const b of bumps) {
    g.fillCircle(b.x, b.y, b.r);
  }

  // Sombra interior (el relieve de la cera se hunde hacia abajo).
  g.fillStyle(shade, 0.22);
  g.fillCircle(64, 72, 36);

  // Relieve: anillo perimetral + frasco grabado en el centro.
  g.lineStyle(5, shade, 0.5);
  g.strokeCircle(64, 62, 26);
  g.fillStyle(shade, 0.5);
  g.fillTriangle(56, 50, 72, 50, 64, 66); // cuerpo cónico del frasco
  g.fillRect(60, 42, 8, 10); // cuello
  g.fillCircle(64, 70, 4); // base

  // Brillo de la cera: dos luces suaves arriba a la izquierda.
  g.fillStyle(shine, 0.15);
  g.fillCircle(46, 42, 17);
  g.fillStyle(shine, 0.3);
  g.fillCircle(44, 40, 9);
}

/**
 * Registro de texturas: primera hornada (PLAN Etapa 1) + iconos de la
 * Etapa 2 («Cómo jugar» y toggle de mute) + fondo «lab» de la Etapa 3 +
 * la niña de la Etapa 4 + el sello de cera de la Etapa 6. Hornadas futuras
 * (Hyde…) se añaden aquí o en registros posteriores.
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
  {
    key: TEXTURE_KEYS.iconBook,
    width: 128,
    height: 128,
    description: 'Libro abierto: paso 1 del «Cómo jugar» (leer la viñeta).',
    draw: drawIconBook,
  },
  {
    key: TEXTURE_KEYS.iconTap,
    width: 128,
    height: 128,
    description: 'Dedo sobre una diana: paso 2 del «Cómo jugar» (tocar al objetivo).',
    draw: drawIconTap,
  },
  {
    key: TEXTURE_KEYS.iconQuestion,
    width: 128,
    height: 128,
    description: 'Carta pergamino con «?»: paso 3 del «Cómo jugar» (responder el quiz).',
    draw: drawIconQuestion,
  },
  {
    key: TEXTURE_KEYS.speakerOn,
    width: 96,
    height: 96,
    description: 'Altavoz con ondas: sonido activado (toggle de mute del menú).',
    draw: drawSpeakerOn,
  },
  {
    key: TEXTURE_KEYS.speakerOff,
    width: 96,
    height: 96,
    description: 'Altavoz con aspa: silencio (toggle de mute).',
    draw: drawSpeakerOff,
  },
  {
    key: TEXTURE_KEYS.labBench,
    width: 720,
    height: 260,
    description: 'Mesa de laboratorio del fondo narrativo «lab» (Etapa 3).',
    draw: drawLabBench,
  },
  {
    key: TEXTURE_KEYS.labFlask,
    width: 96,
    height: 128,
    description:
      'Matraz Erlenmeyer neutro, teñible vía tint (verde/púrpura) para el laboratorio.',
    draw: drawLabFlask,
  },
  {
    key: TEXTURE_KEYS.girl,
    width: 96,
    height: 176,
    description: 'La niña: silueta pequeña con farol iluminado (objetivo del minijuego N1).',
    draw: drawGirl,
  },
  {
    key: TEXTURE_KEYS.waxSeal,
    width: 128,
    height: 128,
    description: 'Sello de cera púrpura del diploma de victoria (borde irregular y brillo).',
    draw: drawWaxSeal,
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
