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
  fogFar,
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
  /** El Dr. Jekyll: doctor recto con bata clara y copa, frasco en mano (intro). */
  jekyll: 'jekyll',
  /** Mr. Hyde: silueta jorobada y bestia de la transformación (intro). */
  hyde: 'hyde',
  /** Brazo delantero de Hyde con garras: sprite articulado (pivote de hombro). */
  hydeArm: 'hyde-arm',
  /** Flecha de navegación (apunta a la DERECHA; flipX para «atrás»). */
  arrow: 'arrow',
  /** Estrella del cielo nocturno (destello de 4 puntas, titila en runtime). */
  star: 'star',
  // --- Fase 2 (PLAN): personajes y props de los niveles 2 y 3 ---

  /** El Dr. Lanyon: médico victoriano distinguido (objetivo del Nivel 2). */
  lanyon: 'lanyon',
  /** El bastón de MANGO BLANCO del Nivel 2 (mecánica «cane-strike»). */
  cane: 'cane',
  /** Poole el mayordomo: golpea la puerta del laboratorio (Nivel 3). */
  poole: 'poole',
  /** El abogado Utterson: corpulento, abrigo pesado y bastón (Nivel 3). */
  utterson: 'utterson',
  /** Puerta pesada del laboratorio: roble cerrado en marco de piedra (N3). */
  labDoor: 'lab-door',
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
  const silhouette = hexToNumber(fogFar); // un tono MÁS claro que los edificios: se recorta de la noche
  const fire = hexToNumber(lampFire);

  // Resplandor cálido alrededor de TODO el cuerpo: la luz de su propio farol
  // la separa de la noche (antes su silueta era igual de oscura que el fondo).
  g.fillStyle(fire, 0.1);
  g.fillCircle(48, 82, 55);
  g.fillStyle(fire, 0.14);
  g.fillCircle(48, 70, 38);

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

  // Rim light del lado del farol: el borde del brazo y del vestido que da a
  // la luz se enciende cálido — la figura se lee aunque la noche la trague.
  g.fillStyle(fire, 0.55);
  g.fillTriangle(51, 44, 55, 68, 49, 66);
  g.fillTriangle(51, 72, 64, 118, 57, 116);

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

// ---- Texturas de la intro (cinemática pre-nivel, PLAN fase 1/3) --------------

/**
 * El Dr. Jekyll (intro, acto 1): doctor RECTO y elegante — sombrero de copa,
 * bata de laboratorio clara (parchmentLight) con botones, y un matraz
 * Erlenmeyer levantado en la mano derecha (mismo lenguaje de vidrio/líquido
 * que `lab-flask`, aquí con el líquido YA verde: es su fórmula terminada).
 * Silueta legible y amable — es el «antes» de la transformación. La animación
 * (entrada, inclinación al beber, crossfade) es runtime, no parte de la
 * textura. Determinista.
 */
function drawJekyll(g: Phaser.GameObjects.Graphics): void {
  const dark = hexToNumber(buildings); // cabeza, sombrero, manos y piernas
  const coat = hexToNumber(parchmentLight); // bata de laboratorio clara
  const ink = hexToNumber(parchmentDark); // cinta del sombrero y botones
  const glass = hexToNumber(textPrimary); // contorno del vidrio y camisa
  const liquid = hexToNumber(labGreen); // la fórmula

  // Halo del frasco (la poción «respira» aunque la textura es estática).
  g.fillStyle(liquid, 0.12);
  g.fillCircle(100, 44, 20);

  // Brazo izquierdo colgando (manga de la bata) + mano.
  g.fillStyle(coat, 1);
  g.fillTriangle(44, 88, 30, 132, 50, 136);
  g.fillStyle(dark, 1);
  g.fillCircle(36, 140, 6);

  // Bata: torso + faldón acampanado en dos paños.
  g.fillStyle(coat, 1);
  g.fillRect(42, 76, 44, 92);
  g.fillTriangle(42, 148, 26, 196, 54, 196);
  g.fillTriangle(86, 148, 102, 196, 74, 196);
  // Camisa asomando (V del cuello) y botones.
  g.fillStyle(glass, 1);
  g.fillTriangle(56, 76, 72, 76, 64, 94);
  g.fillStyle(ink, 1);
  g.fillRect(62, 102, 4, 4);
  g.fillRect(62, 116, 4, 4);
  g.fillRect(62, 130, 4, 4);

  // Brazo derecho en alto (manga) sujetando el matraz.
  g.fillStyle(coat, 1);
  g.fillTriangle(80, 86, 98, 62, 90, 100);
  // Matraz: corcho, líquido verde, burbujas y contorno de vidrio.
  g.fillStyle(ink, 1);
  g.fillRect(94, 18, 12, 7);
  g.fillStyle(liquid, 0.9);
  g.fillTriangle(89, 54, 111, 54, 100, 40);
  g.fillStyle(glass, 0.5);
  g.fillCircle(97, 48, 3);
  g.fillCircle(104, 44, 2);
  g.lineStyle(3, glass, 0.85);
  g.beginPath();
  g.moveTo(95, 25);
  g.lineTo(95, 38);
  g.lineTo(87, 56);
  g.lineTo(113, 56);
  g.lineTo(105, 38);
  g.lineTo(105, 25);
  g.strokePath();
  // Mano sobre la base del matraz.
  g.fillStyle(dark, 1);
  g.fillCircle(100, 62, 7);

  // Cuello y cabeza (silueta), después el sombrero de copa con cinta.
  g.fillStyle(dark, 1);
  g.fillRect(58, 70, 12, 8);
  g.fillCircle(64, 58, 14);
  g.fillRect(46, 8, 36, 34); // copa
  g.fillRect(38, 40, 52, 7); // ala
  g.fillStyle(ink, 1);
  g.fillRect(46, 30, 36, 6); // cinta

  // Piernas y zapatos.
  g.fillStyle(dark, 1);
  g.fillRect(50, 192, 11, 24);
  g.fillRect(67, 192, 11, 24);
  g.fillRect(44, 214, 19, 8);
  g.fillRect(65, 214, 19, 8);
}

/**
 * Mr. Hyde (intro, acto 1): la versión BESTIA — jorobado y encorvado, cabello
 * salvaje a púas, abrigo harapiento con faldones rotos y pies descalzos
 * grandes. Silueta inquietante pero SIN sangre ni heridas (público 10+): la
 * amenaza la cuentan la postura y dos acentos «resabio de la poción» — el
 * ojo verde brillante y un aura púrpura tenue. La cara se lee de LEJOS (se
 * renderiza a escala 1.7): ojo verde de doble halo con brillo, gruñido con
 * DIENTES pálidos y mandíbula prognata. El BRAZO DELANTERO no va aquí: es la
 * textura `hyde-arm`, un sprite articulado que la escena gira desde el
 * hombro (movilidad del acecho). Determinista.
 */
function drawHyde(g: Phaser.GameObjects.Graphics): void {
  const dark = hexToNumber(buildings); // silueta completa
  const eye = hexToNumber(labGreen); // ojo brillante
  const aura = hexToNumber(potionPurple); // resabio de la poción
  const pale = hexToNumber(parchmentLight); // dientes y brillo del ojo

  // Aura púrpura tenue + volutas que se desprenden (la poción se le escapa).
  g.fillStyle(aura, 0.1);
  g.fillCircle(64, 118, 62);
  g.fillStyle(aura, 0.16);
  g.fillCircle(40, 64, 10);
  g.fillCircle(78, 52, 8);
  g.fillCircle(58, 38, 6);

  // Cuerpo jorobado: chepa redonda + masa inferior + cuello hacia la cabeza.
  g.fillStyle(dark, 1);
  g.fillCircle(64, 120, 46);
  g.fillRect(34, 130, 66, 48);
  g.fillTriangle(78, 104, 104, 86, 108, 134);

  // Cabeza baja y prognata.
  g.fillCircle(102, 92, 17);
  g.fillCircle(108, 100, 9);

  // Cabello salvaje: púas y mechones alrededor de la cabeza.
  g.fillTriangle(84, 80, 90, 56, 98, 78);
  g.fillTriangle(94, 74, 104, 50, 112, 76);
  g.fillTriangle(108, 80, 120, 62, 120, 86);
  g.fillCircle(88, 74, 8);
  g.fillCircle(102, 66, 8);

  // El ojo verde (punto focal, TRIPLE halo como los faroles de la niña) con
  // brillo blanco: la cara se entiende incluso a escala de cinemática.
  g.fillStyle(eye, 0.14);
  g.fillCircle(106, 88, 12);
  g.fillStyle(eye, 0.26);
  g.fillCircle(106, 88, 8.5);
  g.fillStyle(eye, 0.5);
  g.fillCircle(106, 88, 5.5);
  g.fillStyle(eye, 1);
  g.fillCircle(106, 88, 3.6);
  g.fillStyle(pale, 0.9);
  g.fillCircle(104.6, 86.6, 1.6);

  // Ceja: pico del cerrillo que separa el ojo de la frente (gesto de furia).
  g.fillStyle(aura, 0.55);
  g.fillTriangle(98, 82, 114, 79, 112, 85);

  // Gruñido: la mandíbula prognata se abre en dientes pálidos (sin sangre).
  g.fillStyle(pale, 0.95);
  g.fillTriangle(101, 102, 105, 102, 103, 107);
  g.fillTriangle(105, 103, 109, 103, 107, 108);
  g.fillTriangle(109, 103, 113, 102, 111, 107);
  g.fillTriangle(113, 102, 116, 101, 115, 106);

  // Abrigo harapiento: faldones rotos colgando a distinta altura (vuelve la
  // silueta oscura tras los dientes pálidos).
  g.fillStyle(dark, 1);
  g.fillTriangle(30, 152, 20, 198, 46, 180);
  g.fillTriangle(46, 170, 54, 206, 70, 182);
  g.fillTriangle(70, 178, 82, 200, 94, 176);
  g.fillTriangle(94, 168, 102, 190, 108, 156);

  // Piernas cortas y pies descalzos grandes.
  g.fillRect(48, 176, 13, 34);
  g.fillRect(74, 174, 13, 36);
  g.fillRect(40, 208, 22, 9);
  g.fillRect(74, 210, 22, 9);

  // Brazo trasero (corto a la vista) con dos garras.
  g.fillTriangle(40, 118, 26, 178, 46, 182);
  g.fillTriangle(22, 178, 16, 196, 28, 184);
  g.fillTriangle(26, 182, 24, 200, 34, 186);
}

/**
 * Brazo delantero de Mr. Hyde (intro): pieza ARTICULADA que la escena monta
 * sobre el cuerpo con el pivote en el hombro (origin 0.5, 0.125 ≈ el nudo
 * (36,16) de esta textura 72×128). La longitud hombro→garra (~88 px, la misma
 * proporción que el brazo dibujado del cuerpo) hace que colgando llegue al
 * suelo; los tweens de rotación de la escena lo balancean al caminar y lo
 * ALZAN en el acecho — con hombro propio el gesto tiene la movilidad que un
 * sprite único no puede dar. Garra pálida de tres uñas (mismo lenguaje que
 * el ojo). Determinista.
 */
function drawHydeArm(g: Phaser.GameObjects.Graphics): void {
  const dark = hexToNumber(buildings); // brazo (misma silueta que el cuerpo)
  const aura = hexToNumber(potionPurple); // rim light del abrigo
  const pale = hexToNumber(parchmentLight); // garras

  // Brazo: del hombro (36,16) baja grueso y se afina hacia la muñeca (34,84).
  g.fillStyle(dark, 1);
  g.fillTriangle(22, 22, 50, 20, 40, 86);
  g.fillTriangle(22, 22, 40, 86, 28, 82);
  // Manguito del hombro (el «músculo» que tapa el nudo del pivote).
  g.fillCircle(36, 24, 14);
  // Rim light púrpura del lado exterior (resabio de la poción, como el aura).
  g.fillStyle(aura, 0.3);
  g.fillTriangle(45, 25, 50, 20, 40, 86);

  // Mano cerrada en la muñeca.
  g.fillStyle(dark, 1);
  g.fillCircle(34, 90, 8);

  // Tres garras pálidas curvadas hacia abajo (amenaza sin sangre).
  g.fillStyle(pale, 0.95);
  g.fillTriangle(23, 93, 30, 92, 25, 112);
  g.fillTriangle(31, 95, 37, 94, 34, 115);
  g.fillTriangle(38, 94, 44, 92, 41, 112);
}

// ---- Texturas de navegación y cielo (flechas de página, estrellas) -----------

/**
 * Estrella del cielo nocturno: destello de 4 puntas con núcleo brillante
 * (marcador pálido de la paleta, visible sobre la noche #0d0f14). La escena
 * la titila por opacidad con `lampFlicker` y fases propias por estrella.
 * Determinista.
 */
function drawStar(g: Phaser.GameObjects.Graphics): void {
  const glow = hexToNumber(textPrimary);

  // Halo suave + cruz de 4 puntas (dos rombos finos) + núcleo.
  g.fillStyle(glow, 0.16);
  g.fillCircle(16, 16, 10);
  g.fillStyle(glow, 0.85);
  g.fillTriangle(16, 1, 19, 16, 13, 16);
  g.fillTriangle(16, 31, 19, 16, 13, 16);
  g.fillTriangle(1, 16, 16, 13, 16, 19);
  g.fillTriangle(31, 16, 16, 13, 16, 19);
  g.fillStyle(glow, 1);
  g.fillCircle(16, 16, 2.4);
}

/**
 * Flecha de navegación (apunta a la DERECHA; la escena la voltea con flipX
 * para «atrás»): triángulo pergamino claro con borde oscuro — legible sobre
 * la niebla nocturna Y sobre el pergamino del panel. Táctil ≥ 64 px: la
 * escena la escala y le pone hitArea propio. Determinista.
 */
function drawArrow(g: Phaser.GameObjects.Graphics): void {
  const edge = hexToNumber(parchmentDark);
  const fill = hexToNumber(parchmentLight);

  // Borde oscuro (triángulo mayor) + relleno claro (triángulo interior).
  g.fillStyle(edge, 1);
  g.fillTriangle(4, 4, 58, 48, 4, 92);
  g.fillStyle(fill, 1);
  g.fillTriangle(16, 24, 44, 48, 16, 72);
}

// ---- Texturas de la Fase 2 (personajes y props de los niveles 2 y 3) --------

/**
 * El Dr. Lanyon (objetivo del Nivel 2): médico distinguido VICTORIANO en
 * silueta oscura (buildings, como los edificios del callejón) con detalles
 * que lo separan de Jekyll: sombrero de copa MÁS ALTA que el del doctor,
 * barba abundante, abrigo largo con faldones hasta las pantorrillas y su
 * propio bastón en la mano izquierda. El acento cálido que evita que sea un
 * clon de la silueta de Jekyll es un RELOJ DE BOLSILLO de latón (lampFire)
 * con cadena pálida y doble halo tenue. Determinista, sin sangre.
 */
function drawLanyon(g: Phaser.GameObjects.Graphics): void {
  const dark = hexToNumber(buildings); // silueta completa
  const brass = hexToNumber(lampFire); // reloj de bolsillo de latón
  const pale = hexToNumber(parchmentLight); // cadena y botones del chaleco
  const ink = hexToNumber(parchmentDark); // cinta del sombrero y raya del abrigo

  // Halo cálido tenue alrededor del reloj (el acento distintivo de Lanyon).
  g.fillStyle(brass, 0.1);
  g.fillCircle(46, 104, 26);
  g.fillStyle(brass, 0.16);
  g.fillCircle(46, 104, 16);

  // Piernas y zapatos (los faldones del abrigo caerán sobre ellos).
  g.fillStyle(dark, 1);
  g.fillRect(48, 160, 12, 40);
  g.fillRect(66, 160, 12, 40);
  g.fillRect(42, 198, 21, 8);
  g.fillRect(62, 198, 21, 8);

  // Abrigo largo: torso ancho, hombros y faldones hasta las pantorrillas.
  g.fillRect(40, 68, 46, 88);
  g.fillRect(34, 74, 58, 18); // hombros
  g.fillTriangle(40, 150, 32, 190, 58, 156); // faldón izquierdo
  g.fillTriangle(86, 150, 94, 190, 68, 156); // faldón derecho

  // Raya del abrigo y botones pálidos del chaleco que asoman.
  g.fillStyle(ink, 1);
  g.fillRect(59, 86, 2, 66);
  g.fillStyle(pale, 0.8);
  g.fillRect(58, 92, 4, 4);
  g.fillRect(58, 104, 4, 4);
  g.fillRect(58, 116, 4, 4);
  g.fillRect(58, 128, 4, 4);

  // Reloj de bolsillo de latón: cadena pálida, caja y esfera oscura.
  g.fillStyle(pale, 0.6);
  g.fillRect(50, 96, 3, 12);
  g.fillStyle(brass, 1);
  g.fillCircle(46, 112, 6);
  g.fillStyle(ink, 1);
  g.fillCircle(46, 112, 2.4);

  // Brazo izquierdo colgando con SU PROPIO bastón (pomo, vara y mano).
  g.fillStyle(dark, 1);
  g.fillTriangle(44, 76, 28, 128, 50, 132);
  g.fillCircle(34, 134, 6); // mano
  g.fillRect(32, 138, 4, 56); // vara
  g.fillCircle(33, 136, 5); // pomo

  // Brazo derecho colgando.
  g.fillTriangle(82, 78, 98, 126, 76, 130);

  // Cuello, cabeza y BARBA abundante (la diferencia clave con Jekyll).
  g.fillStyle(dark, 1);
  g.fillRect(54, 60, 16, 8);
  g.fillCircle(60, 48, 13);
  g.fillTriangle(47, 52, 73, 52, 60, 84);
  g.fillCircle(52, 66, 6);
  g.fillCircle(68, 66, 6);

  // Sombrero de copa MUY ALTA (más que la de Jekyll) con cinta y ala.
  g.fillRect(42, 2, 36, 30);
  g.fillRect(34, 30, 52, 7);
  g.fillStyle(ink, 1);
  g.fillRect(42, 24, 36, 6);
}

/**
 * El BASTÓN DE MANGO BLANCO del Nivel 2 (mecánica «cane-strike»): bastón de
 * paseo —NADA de arma sangrienta, público 10+— en horizontal (180×48) listo
 * para que la escena lo esgrima o lo gire. El mango pálido (parchmentLight)
 * en «L» con curva de paseo es el punto focal: doble halo tenue del mismo
 * color lo hace leer CLARAMENTE como mango blanco de lejos; el puño lleva
 * muescas de agarre y la unión mango/vara un aro de latón (lampFire), como
 * la férula de la punta. La vara es oscura (buildings) y se afina. La escena
 * puede voltearlo (flipX) para que Hyde lo empuñe. Determinista.
 */
function drawCane(g: Phaser.GameObjects.Graphics): void {
  const dark = hexToNumber(buildings); // vara
  const pale = hexToNumber(parchmentLight); // mango blanco
  const brass = hexToNumber(lampFire); // aro de la unión y férula
  const ink = hexToNumber(parchmentDark); // sombra y muescas del mango

  // Doble halo suave alrededor del mango (el blanco se lee de lejos).
  g.fillStyle(pale, 0.1);
  g.fillCircle(56, 16, 20);
  g.fillStyle(pale, 0.14);
  g.fillCircle(56, 16, 13);

  // Vara oscura y delgada que se afina hacia la punta (dos tramos).
  g.fillStyle(dark, 1);
  g.fillRect(52, 24, 84, 6);
  g.fillRect(136, 25, 34, 4);

  // Aro de latón en la unión mango/vara y férula de latón en la punta.
  g.fillStyle(brass, 0.95);
  g.fillRect(50, 22, 8, 10);
  g.fillRect(166, 24, 10, 6);

  // MANGO BLANCO en «L»: puño horizontal + cuello vertical hacia la vara.
  g.fillStyle(pale, 1);
  g.fillRect(42, 4, 32, 9);
  g.fillRect(46, 4, 9, 26);
  g.fillCircle(46, 8, 7); // la esquina de la curva de paseo abulta

  // Sombra bajo el puño y muescas de agarre (veteado del marfil).
  g.fillStyle(ink, 0.35);
  g.fillRect(42, 11, 32, 2);
  g.fillRect(54, 5, 2, 5);
  g.fillRect(61, 5, 2, 5);
  g.fillRect(68, 5, 2, 5);
}

/**
 * Poole el mayordomo (Nivel 3): figura ALTA en chaqueta de librea oscura
 * (buildings) con chaleco (street) de botones pálidos, cuello blanco de
 * sirviente y sin sombrero (pelo corto). Pose NERVIOSA pero decidida: el
 * brazo derecho EN ALTO golpeando la puerta del laboratorio, con chispas
 * cálidas (lampFire) en el punto del golpe — el mismo lenguaje de las
 * farolas. Sin sangre, tono caricaturesco. Determinista.
 */
function drawPoole(g: Phaser.GameObjects.Graphics): void {
  const dark = hexToNumber(buildings); // librea y silueta
  const vest = hexToNumber(street); // chaleco
  const pale = hexToNumber(parchmentLight); // botones y cuello
  const fire = hexToNumber(lampFire); // chispas del golpe

  // Piernas (pantalón de librea) y zapatos.
  g.fillStyle(dark, 1);
  g.fillRect(48, 116, 12, 66);
  g.fillRect(64, 116, 12, 66);
  g.fillRect(42, 180, 21, 8);
  g.fillRect(62, 180, 21, 8);

  // Chaqueta de librea: torso, hombros y faldones cortos.
  g.fillRect(42, 48, 38, 72);
  g.fillRect(38, 52, 46, 16);
  g.fillTriangle(42, 114, 32, 150, 54, 118);
  g.fillTriangle(80, 114, 90, 150, 68, 118);

  // Chaleco con botones pálidos (el detalle que lee la librea).
  g.fillStyle(vest, 1);
  g.fillRect(52, 56, 18, 58);
  g.fillStyle(pale, 0.9);
  g.fillRect(58, 66, 4, 4);
  g.fillRect(58, 78, 4, 4);
  g.fillRect(58, 90, 4, 4);
  g.fillRect(58, 102, 4, 4);

  // Cuello blanco de sirviente.
  g.fillStyle(pale, 1);
  g.fillRect(53, 48, 16, 5);

  // Brazo izquierdo colgando, pegado al cuerpo (los nervios lo encogen).
  g.fillStyle(dark, 1);
  g.fillTriangle(44, 58, 28, 102, 50, 106);
  g.fillCircle(34, 108, 6);

  // Brazo DERECHO EN ALTO golpeando: puño cerrado y chispas del impacto.
  g.fillTriangle(76, 58, 96, 22, 84, 64);
  g.fillCircle(98, 20, 8);
  g.fillStyle(fire, 0.85);
  g.fillTriangle(110, 8, 116, 14, 110, 14);
  g.fillTriangle(112, 24, 118, 28, 112, 30);

  // Cabeza descubierta: pelo corto de mayordomo sobre la cara.
  g.fillStyle(dark, 1);
  g.fillCircle(61, 24, 11);
  g.fillCircle(61, 34, 10);
}

/**
 * El abogado Utterson (Nivel 3): hombre CORPULENTO de edad media — abrigo
 * pesado en trapecio ancho (buildings), sombrero de fieltro de copa baja y
 * ala ancha, patillas grises (acento pálido tenue) y bufanda pálida
 * (parchmentLight) con fleco: el acento que lo distingue del resto de la
 * noche. Apoya su PROPIO bastón (trazo diagonal que llega al suelo). Su
 * seriedad la cuenta la postura maciza, sin rasgos agresivos. Determinista.
 */
function drawUtterson(g: Phaser.GameObjects.Graphics): void {
  const dark = hexToNumber(buildings); // abrigo, sombrero y bastón
  const pale = hexToNumber(parchmentLight); // bufanda y patillas
  const ink = hexToNumber(parchmentDark); // cinta del sombrero

  // Piernas y zapatos (el abrigo pesado cae sobre ellas).
  g.fillStyle(dark, 1);
  g.fillRect(46, 158, 13, 38);
  g.fillRect(66, 158, 13, 38);
  g.fillRect(40, 194, 22, 8);
  g.fillRect(63, 194, 22, 8);

  // Abrigo PESADO: trapecio corpulento con ruedo por debajo de la cadera.
  g.fillTriangle(38, 56, 86, 56, 100, 162);
  g.fillTriangle(38, 56, 100, 162, 24, 162);
  g.fillRect(24, 156, 76, 12);

  // Botones pálidos de la doble hilera (legibilidad del abrigo cerrado).
  g.fillStyle(pale, 0.7);
  g.fillRect(54, 84, 4, 4);
  g.fillRect(54, 100, 4, 4);
  g.fillRect(54, 116, 4, 4);

  // Bufanda pálida con faldón y fleco (el acento del abogado).
  g.fillStyle(pale, 1);
  g.fillRect(50, 48, 24, 9);
  g.fillRect(64, 55, 9, 26);
  g.fillStyle(pale, 0.6);
  g.fillRect(66, 79, 6, 4);

  // Brazo izquierdo grueso, enfundado en el abrigo.
  g.fillStyle(dark, 1);
  g.fillTriangle(40, 64, 24, 118, 50, 120);

  // Brazo derecho con el bastón apoyado en el suelo (trazo diagonal).
  g.fillTriangle(84, 66, 98, 116, 76, 118);
  g.fillCircle(94, 120, 6); // mano
  g.lineStyle(4, dark, 1);
  g.beginPath();
  g.moveTo(94, 122);
  g.lineTo(102, 198);
  g.strokePath();
  g.fillCircle(102, 198, 3); // férula

  // Cabeza con patillas de edad (acento pálido tenue).
  g.fillCircle(62, 41, 13);
  g.fillStyle(pale, 0.45);
  g.fillRect(50, 38, 4, 9);
  g.fillRect(70, 38, 4, 9);

  // Sombrero de fieltro: copa baja redondeada y ala ancha con cinta.
  g.fillStyle(dark, 1);
  g.fillRect(48, 12, 28, 14);
  g.fillCircle(62, 12, 12);
  g.fillRect(38, 24, 48, 6);
  g.fillStyle(ink, 1);
  g.fillRect(48, 19, 28, 5);
}

/**
 * Puerta del laboratorio (Nivel 3): puerta PESADA de roble cerrada en un
 * marco de piedra vitoriano. El muro (buildings) lleva juntas de sillería
 * (street en alfa), el marco es piedra más clara (street) con dintel y
 * DOVELA central, y la hoja de roble (parchmentDark, el marrón cálido de la
 * paleta) lleva DOS paneles hundidos con bisagras de latón (lampFire), pomo
 * de latón con doble halo, cerradura y las MARCAS DE GOLPES de Poole y
 * Utterson (muescas pálidas en el panel inferior). Se lee como puerta
 * cerrada de laboratorio: maciza, claveteada, sin sangre. Determinista.
 */
function drawLabDoor(g: Phaser.GameObjects.Graphics): void {
  const stone = hexToNumber(buildings); // muro de piedra
  const joint = hexToNumber(street); // juntas de sillería y marco
  const oak = hexToNumber(parchmentDark); // hoja de roble
  const brass = hexToNumber(lampFire); // pomo, bisagras y placa
  const pale = hexToNumber(parchmentLight); // luces de los paneles y golpes
  const shadow = hexToNumber(buildings); // paneles hundidos y cerradura

  // Muro de piedra: todo el lienzo, con juntas de sillería horizontales.
  g.fillStyle(stone, 1);
  g.fillRect(0, 0, 200, 320);
  g.fillStyle(joint, 0.45);
  g.fillRect(0, 16, 200, 3);
  g.fillRect(0, 110, 200, 3);
  g.fillRect(0, 210, 200, 3);
  g.fillRect(0, 290, 200, 3);
  // Juntas verticales en los costados (dovelas desalineadas, deterministas).
  g.fillRect(8, 40, 3, 70);
  g.fillRect(18, 130, 3, 80);
  g.fillRect(186, 40, 3, 80);
  g.fillRect(176, 140, 3, 70);

  // Marco de piedra (más claro que el muro) alrededor del vano.
  g.fillStyle(joint, 1);
  g.fillRect(30, 40, 140, 280);

  // Dintel con dovela central de la clave (arco aplanado vitoriano).
  g.fillRect(22, 30, 156, 14);
  g.fillTriangle(90, 22, 110, 22, 106, 44);
  g.fillTriangle(94, 44, 106, 44, 100, 22);
  g.fillStyle(pale, 0.25);
  g.fillRect(22, 32, 156, 3); // luz del canto superior del dintel

  // Umbral de piedra en la base.
  g.fillStyle(joint, 1);
  g.fillRect(24, 308, 152, 12);

  // Hoja de roble (marrón cálido) con vetas verticales tenues.
  g.fillStyle(oak, 1);
  g.fillRect(42, 52, 116, 268);
  g.fillStyle(shadow, 0.5);
  g.fillRect(66, 52, 2, 268);
  g.fillRect(96, 52, 2, 268);
  g.fillRect(126, 52, 2, 268);

  // Paneles hundidos con luz pálida en el canto superior.
  g.fillStyle(shadow, 1);
  g.fillRoundedRect(56, 72, 88, 84, 6);
  g.fillRoundedRect(56, 176, 88, 96, 6);
  g.fillStyle(pale, 0.25);
  g.fillRect(58, 74, 84, 3);
  g.fillRect(58, 178, 84, 3);

  // Bisagras de latón en el lado izquierdo.
  g.fillStyle(brass, 0.85);
  g.fillRect(36, 96, 8, 14);
  g.fillRect(36, 200, 8, 14);

  // Placa del doctor (latón, sin texto: la escena superpone el rótulo).
  g.fillStyle(brass, 0.45);
  g.fillRect(78, 60, 44, 10);

  // Pomo de latón con doble halo (resplandor del gas del pasillo).
  g.fillStyle(brass, 0.18);
  g.fillCircle(146, 186, 16);
  g.fillStyle(brass, 0.3);
  g.fillCircle(146, 186, 11);
  g.fillStyle(brass, 1);
  g.fillCircle(146, 186, 7);
  // Placa de la cerradura con ojo de la cerradura oscuro.
  g.fillStyle(brass, 0.6);
  g.fillRect(140, 180, 12, 26);
  g.fillStyle(shadow, 1);
  g.fillCircle(146, 198, 2.6);

  // Marcas de golpes de Poole y Utterson: muescas pálidas en el panel bajo.
  g.fillStyle(pale, 0.35);
  g.fillRect(90, 236, 7, 3);
  g.fillRect(103, 244, 7, 3);
  g.fillRect(94, 253, 7, 3);
}

/**
/**
 * Registro de texturas: primera hornada (PLAN Etapa 1) + iconos de la
 * Etapa 2 («Cómo jugar» y toggle de mute) + fondo «lab» de la Etapa 3 +
 * la niña de la Etapa 4 + el sello de cera de la Etapa 6 + los dos personajes
 * de la intro (Jekyll/Hyde, cinemática pre-nivel) + el brazo articulado de
 * Hyde y la flecha de navegación + la Fase 2 del PLAN (personajes y props de
 * los niveles 2 y 3: Lanyon, el bastón de mango blanco, Poole, Utterson y la
 * puerta del laboratorio). Hornadas futuras se añaden
 * AQUÍ AL FINAL (hay tests que hacen slicing por índice del registro).
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
  {
    key: TEXTURE_KEYS.jekyll,
    width: 128,
    height: 224,
    description:
      'El Dr. Jekyll: doctor recto con bata clara y copa, matraz de fórmula en alto (intro).',
    draw: drawJekyll,
  },
  {
    key: TEXTURE_KEYS.hyde,
    width: 144,
    height: 240,
    description:
      'Mr. Hyde: silueta jorobada y bestia con ojo verde y dientes, SIN brazo delantero (intro).',
    draw: drawHyde,
  },
  {
    key: TEXTURE_KEYS.hydeArm,
    width: 72,
    height: 128,
    description:
      'Brazo delantero de Hyde con garras: sprite articulado con pivote en el hombro (intro).',
    draw: drawHydeArm,
  },
  {
    key: TEXTURE_KEYS.arrow,
    width: 64,
    height: 96,
    description:
      'Flecha de navegación a la derecha (flipX = atrás): avance/retroceso de páginas narrativas.',
    draw: drawArrow,
  },
  {
    key: TEXTURE_KEYS.star,
    width: 32,
    height: 32,
    description:
      'Estrella del cielo nocturno de 4 puntas: titila por opacidad en los fondos exteriores.',
    draw: drawStar,
  },
  {
    key: TEXTURE_KEYS.lanyon,
    width: 128,
    height: 208,
    description:
      'El Dr. Lanyon: médico distinguido con copa alta, barba, faldones y reloj de latón (objetivo del N2).',
    draw: drawLanyon,
  },
  {
    key: TEXTURE_KEYS.cane,
    width: 180,
    height: 48,
    description:
      'Bastón de paseo de MANGO BLANCO con aro de latón: el prop de la mecánica «cane-strike» (N2).',
    draw: drawCane,
  },
  {
    key: TEXTURE_KEYS.poole,
    width: 120,
    height: 200,
    description:
      'Poole el mayordomo: librea oscura con botones pálidos y brazo en alto golpeando (N3).',
    draw: drawPoole,
  },
  {
    key: TEXTURE_KEYS.utterson,
    width: 124,
    height: 204,
    description:
      'El abogado Utterson: corpulento, abrigo pesado, sombrero de fieltro, bufanda y bastón (N3).',
    draw: drawUtterson,
  },
  {
    key: TEXTURE_KEYS.labDoor,
    width: 200,
    height: 320,
    description:
      'Puerta pesada de roble cerrada en marco de piedra, con pomo de latón y marcas de golpes (N3).',
    draw: drawLabDoor,
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
