/**
 * DATOS PUROS de las secuencias animadas de los minijuegos N2/N3 (Fase 3
 * del multi-nivel): swing del bastón, hop de esquiva, caída al suelo, línea
 * de victoria, animación de transformación Hyde↔Jekyll, intro del asedio y
 * entrada de Poole/Utterson. `ActionScene` solo CONSUME estas tablas — así
 * las secuencias completas son testeables sin Phaser (jsdom no puede
 * cargarlo) y la escena queda como capa fina (SPEC §10.3 data-driven).
 *
 * Todo el timing está en ms y los ángulos en radianes. Nada de lógica de
 * estado: eso viven en los reducers (caneState / transformState).
 */

import { TEXTURE_KEYS } from '../art/textures';
import { parchmentDark } from '../config/palette';

// ---- N2: swing del bastón ------------------------------------------------------

/**
 * El bastón de mango blanco entra en escena con un SWING teatral sobre el
 * punto del golpe: aparece girado hacia arriba, baja al golpear y se va.
 * Pool de 2 sprites (dos bastonazos seguidos no se pisan, SPEC §10.4).
 * El origen del giro está en el PUÑO (extremo derecho del sprite: la textura
 * de 180×48 pone el mango blanco a la IZQUIERDA, así que Hyde empuña por la
 * derecha y la punta barre hacia el objetivo).
 */
export const CANE_SWING = {
  /** Pool de sprites del bastón (acotado, SPEC §10.4). */
  poolSize: 2,
  /** Duración total del swing entra-golpea-sale (ms, ~200–300). */
  ms: 260,
  /** Fracción del swing que dura la bajada del golpe (0..1). */
  strikeFraction: 0.4,
  /** Ángulo inicial (armado, hacia arriba; radianes). */
  fromRad: -1.15,
  /** Ángulo del impacto (bajado sobre el objetivo; radianes). */
  toRad: 0.35,
  /** Origen del giro en X (fracción del ancho: el puño de Hyde). */
  originX: 0.86,
  /** Offset del centro del swing respecto al punto del golpe (px). */
  offsetX: -20,
  offsetY: -34,
  /** Alfa pico del sprite (teatral pero no tapa al objetivo). */
  alpha: 0.95,
} as const;

/**
 * Hop de esquiva de Lanyon: cuando el tap queda CERCA pero fuera de la
 * hitbox (near-miss), el doctor da un brinco de susto — feedback vivo sin
 * castigo (SPEC §4.2). La detección usa `isHit` con esta expansión extra
 * (sobre la ya generosa +20 %).
 */
export const NEAR_MISS_HOP = {
  /** Expansión del hitbox para considerar un tap «near-miss» (×1.9). */
  expansion: 1.9,
  /** Altura del brinco (px). */
  hopPx: 26,
  /** Duración del brinco sube-y-baja (ms). */
  ms: 230,
} as const;

// ---- N2/N3: caída al suelo del callejón/laboratorio ----------------------------

/**
 * Secuencia de caída del objetivo al lograr la meta (Lanyon N2, Hyde N3):
 * rota ~90° hacia un costado y cae al suelo con rebote (ease Bounce), y se
 * QUEDA en el suelo — caricaturesco y sin sangre (público 10+, D4).
 */
export const FALL_SEQUENCE = {
  /** Duración del tween de caída con rebote (ms). */
  tweenMs: 640,
  /**
   * Colchón tras el tween antes de considerar la caída «asentada» (el
   * reducer permanece en `falling` tweenMs + settleMs).
   */
  settleMs: 260,
  /** Rotación final (±, hacia el costado del último movimiento; radianes). */
  rotationRad: 1.45,
  /** Altura final del centro sobre la línea de suelo (px, cuerpo tumbado). */
  lieLiftPx: 8,
  /** Puffs de niebla alrededor del caído (escenografía, no daño). */
  groundPuffs: 3,
} as const;

// ---- N2: línea de victoria de Hyde ---------------------------------------------

/**
 * Carátula/burbuja de pergamino con el grito de Hyde tras la caída de
 * Lanyon (estilo de los paneles del quiz: `parchmentFrame` + Special Elite),
 * con pop-in elástico. Se muestra en la fase `line` del reducer (~1.6 s) y
 * luego la escena hace la transición al QUIZ (bonus incluido, como N1).
 */
export const VICTORY_LINE = {
  /** Clave de la textura del panel (marco pergamino, igual que el quiz). */
  textureKey: TEXTURE_KEYS.parchmentFrame,
  /** Tamaño de despliegue del panel (px). */
  panelWidth: 560,
  panelHeight: 200,
  /** Y del panel (centro, algo por encima del medio para ver a Lanyon). */
  panelY: 600,
  /** Duración del pop-in (ms). */
  popMs: 260,
  /** Tiempo que la línea permanece en pantalla (ms; fase `line` del reducer). */
  holdMs: 1600,
  /** Escala inicial del pop-in (relative; 1 = tamaño final). */
  popFromScale: 0.7,
  /** Estilo del texto de la línea (tipografía Special Elite, SPEC §7.3). */
  textStyle: {
    fontFamily: '"Special Elite", Georgia, serif',
    fontSize: 32,
    color: parchmentDark,
    /** Wrap para que la línea quepa en el pergamino (SPEC §9). */
    wordWrapWidth: 460,
  },
  /** Padding interior del panel para el texto (px). */
  textOffsetY: -6,
} as const;

// ---- N3: transformación Hyde↔Jekyll --------------------------------------------

/**
 * Animación de transformación (ambas direcciones): flash pálido de cámara +
 * aura púrpura pulsante (potionPurple) detrás del objetivo + wobble de
 * escala. La textura se intercambia a mitad del wobble.
 */
export const TRANSFORM_ANIM = {
  /** Flash pálido de cámara (ms) — el blanco cálido del pergamino. */
  flashMs: 120,
  /** Duración del wobble de escala (ms; la textura cambia a la mitad). */
  wobbleMs: 460,
  /** Wobble: desviación relativa de escala horizontal (±, sobre la base). */
  wobbleScaleX: 0.12,
  /** Wobble: desviación relativa de escala vertical (±, contrafase). */
  wobbleScaleY: 0.1,
  /** Aura: pulsos de escala/alfa durante la ventana (cantidad). */
  auraPulses: 2,
  /** Duración total de la aura pulsante (ms). */
  auraMs: 620,
  /** Escala inicial de la aura (fog-puff base 256 px). */
  auraScaleFrom: 0.7,
  /** Escala final de la aura. */
  auraScaleTo: 1.6,
  /** Alfa pico de la aura (potionPurple; presente pero discreta). */
  auraAlpha: 0.5,
} as const;

/**
 * En forma Jekyll el objetivo se mueve MÁS LENTO (factor sobre speedRange):
 * la ventana invulnerable también es una tregua para el jugador.
 */
export const JEKYLL_SPEED_FACTOR = 0.5;

/** Feedback pedagógico amable al golpear a Jekyll (floatText/mini-placa). */
export const JEKYLL_MISS_NOTICE = {
  text: '¡Es el doctor Jekyll! Espera a que vuelva a ser Hyde',
  /** Duración de la mini-placa (ms). */
  ms: 1500,
  /** Ancho de wrap del texto (px). */
  wrapWidth: 440,
  /** Y de la placa (bajo el HUD, sobre la zona de juego). */
  y: 316,
  /** Estilo del texto (sepia oscuro sobre pergamino claro, SPEC §9). */
  textStyle: {
    fontFamily: '"Special Elite", Georgia, serif',
    fontSize: 24,
    color: parchmentDark,
  },
} as const;

// ---- N3: intro del asedio (cinemática de la puerta) -----------------------------

/**
 * INTRO del N3 (fase `intro` del reducer, el timer NO corre): 3–4 golpes de
 * puerta de Poole/Utterson (cada uno con shake corto + knock grave), la
 * puerta se abre dejando ver el interior y arranca el juego. Skipeable con
 * un tap (la escena despacha `start` y salta al estado final).
 */
export const SIEGE_INTRO = {
  /** Golpes de puerta (3–4, pedagógicos: «ahí fuera hay gente»). */
  knockCount: 4,
  /** Intervalo entre golpes (ms). */
  knockIntervalMs: 520,
  /** Shake de cámara por golpe (ms; corto, SPEC §7.2 «temblor leve»). */
  shakeMs: 140,
  /** Intensidad del shake por golpe (fracción del viewport). */
  shakeIntensity: 0.004,
  /** Duración de la apertura de la puerta (fade; ms). */
  doorOpenMs: 620,
  /** Respiro tras abrir la puerta antes de arrancar el juego (ms). */
  settleMs: 420,
  /** ¿Se puede saltar con un tap? (accesibilidad, SPEC §9). */
  skippable: true,
} as const;

/**
 * Entrada de Poole y Utterson al laboratorio tras la caída de Hyde (fase
 * `goal`): caminan desde un costado con leve bob, la puerta ya abierta, y
 * ~2 s después la escena hace la transición al QUIZ (bonus incluido).
 */
export const SIEGE_ENTRANCE = {
  /** Duración de la caminata (ms; ~2 s hasta la transición). */
  walkMs: 1400,
  /** Amplitud del bob de caminata (px, mismo lenguaje que GIRL_WALK_BOB). */
  bobPx: 5,
  /** Pasos del bob durante la caminata (yoyo repetidos). */
  bobRepeats: 3,
  /** Retraso del segundo caminante (ms, desencontrados). */
  secondDelayMs: 160,
  /** Colchón tras la caminata antes del QUIZ (ms). */
  settleMs: 700,
} as const;

// ---- N2: estrellas titilando -----------------------------------------------------

/**
 * Estrellas del cielo nocturno del N2 (el callejón de N1 no las tiene; aquí
 * suman profundidad a precio de 5 sprites con asignación de alfa por frame
 * — cero generación de texturas, SPEC §10.4).
 */
export const STAR_TWINKLE = {
  /** Posiciones y escalas de las estrellas (banda de cielo, sobre el HUD). */
  slots: [
    { x: 90, y: 120, scale: 0.9 },
    { x: 250, y: 210, scale: 0.7 },
    { x: 420, y: 90, scale: 1.0 },
    { x: 570, y: 250, scale: 0.8 },
    { x: 670, y: 150, scale: 0.6 },
  ],
  /** Alfa mínima del titileo (la estrella nunca desaparece del todo). */
  minAlpha: 0.25,
  /** Velocidad angular del titileo (rad/s, base — cada una desfasa). */
  speed: 2.3,
} as const;
