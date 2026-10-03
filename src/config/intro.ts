/**
 * DATOS + LÓGICA PURA de la cinemática de introducción (PLAN fases 1–2/3):
 * lo que corre ANTES del primer nivel. ACTO 1 — el Dr. Jekyll bebe su fórmula
 * y se transforma, con animación, en Mr. Hyde. ACTO 2 — Hyde camina por un
 * callejón nocturno, aparece una niña con su farol y Hyde la ve, avanza y
 * ALZA EL BRAZO: amenaza sugerida, jamás contacto (la niña queda «asustada
 * pero ilesa», lore del quiz del N1). El cierre dirige al JUGADOR («tú eres
 * Mr. Hyde») para que se entienda que los toques del minijuego los da Hyde.
 * Al terminar se pasa a la narrativa del nivel 1 (`SceneKey.NARRATIVE` con
 * `{ levelId }`).
 *
 * Arquitectura data-first (mismo espíritu que `config/narrative.ts`): TODO lo
 * testeable vive aquí, sin Phaser en runtime (jsdom no puede cargarlo) —
 * `IntroScene` solo consume estas tablas y funciones:
 *
 *  1. Máquina de ACTOS/BEATS: `INTRO_BEATS` es un array ORDENADO de pasos
 *     (`{ id, durationMs, caption }`). La escena entra al beat 0, y cada beat
 *     se auto-avanza al agotarse su duración O por tap en cualquier punto.
 *     Añadir un acto = añadir entradas a este array + su "player" en la
 *     escena. Nada más.
 *  2. Captions: `INTRO_CAPTIONS` (letreros tipo pergamino, español, tono 10+).
 *  3. Config de animación por beat: `INTRO_ENTRANCE` / `INTRO_DRINK` /
 *     `INTRO_TRANSFORMATION` (acto 1) e `INTRO_ALLEY_WALK` /
 *     `INTRO_GIRL_APPEARS` / `INTRO_MENACE` / `INTRO_PLAYER_IS_HYDE` (acto 2).
 *  4. Layout de la escena: `INTRO_SCENE_LAYOUT` (posiciones sobre 720×1280,
 *     profundidades, estilo del letrero — tipografía Crimson Text, SPEC §7.3).
 *  5. Destino: `INTRO_TARGET_LEVEL_ID` (nivel al que se llega tras la intro).
 *
 * NOTA de flujo: la intro SOLO se reproduce saliendo del menú (MENU → INTRO);
 * las aristas alternativas (quiz fallido → NARRATIVE) NO la reproducen.
 */

import { BASE_WIDTH } from './dimensions';
import { fogNear, labGreen, lampFire, parchmentDark, potionPurple } from './palette';
import { TEXTURE_KEYS } from '../art/textures';
import type { HexColor } from './palette';

// ---- 1. Identidades de los beats (const-object, NO enum) ---------------------

/**
 * Ids de los beats de la cinemática: el ACTO 1 (el laboratorio) y el ACTO 2
 * (el callejón: Hyde ve a la niña y la amenaza). El `Record` de players de
 * `IntroScene` exige cubrir cada id, así que el compilador guía cualquier
 * ampliación.
 */
export const IntroBeatId = {
  /** ACTO 1 — Jekyll aparece en su laboratorio con el letrero de época. */
  Entrance: 'entrance',
  /** ACTO 1 — Levanta el frasco, bebe y queda la pausa dramática. */
  Drink: 'drink',
  /** ACTO 1 — La transformación: flash, sacudida, niebla y crossfade Jekyll → Hyde. */
  Transformation: 'transformation',
  /** ACTO 2 — Hyde cruza el callejón nocturno (fondo troca con velo). */
  AlleyWalk: 'alleyWalk',
  /** ACTO 2 — La niña entra por la esquina con su farol encendido. */
  GirlAppears: 'girlAppears',
  /** ACTO 2 — Hyde la ve, avanza acechando y ALZA EL BRAZO (sin contacto). */
  Menace: 'menace',
  /** ACTO 2 — Cierre: la niebla crece y el letrero dirige al jugador. */
  PlayerIsHyde: 'playerIsHyde',
} as const;

export type IntroBeatId = (typeof IntroBeatId)[keyof typeof IntroBeatId];

// ---- 2. Captions (letreros visibles — pasan por content.test) ----------------

/** Letreros de la intro (español, tono 10+, coherentes con el lore del N1). */
export const INTRO_CAPTIONS = {
  /** Beat de entrada: época + lugar + qué está a punto de hacer. */
  entrance: 'Londres, 188X. En su laboratorio, el Dr. Jekyll termina su fórmula…',
  /** Beat de transformación: el remate del acto 1. */
  transformation: '…y deja de ser él.',
  /** Beat del paseo: retoma el arranque del panel 3 del lore del N1. */
  alleyWalk: 'Mr. Hyde camina por el callejón. La niebla se pega a sus pasos…',
  /** Beat de la niña: verbatim del panel 3 del lore (continuidad narrativa). */
  girlAppears: 'Una niña con farol aparece en la esquina…',
  /** Beat de amenaza: sugerida, nunca gráfica — el golpe no llega a caer. */
  menace: 'Hyde la ve. Avanza despacio… y alza el brazo. La niña se encoge, asustada.',
  /** Cierre: el mensaje CLAVE — quien juega, quien asusta, es Mr. Hyde. */
  playerIsHyde: 'Y tú eres Mr. Hyde. Es hora del susto.',
} as const;

/** Un beat de la máquina: duración y letrero del paso (datos puros). */
export interface IntroBeat {
  /** Identidad del paso (valor de `IntroBeatId`). */
  id: IntroBeatId;
  /**
   * Duración del beat en ms: al agotarse, la escena avanza al siguiente (o
   * cierra si es el último). Un tap adelanta el avance.
   */
  durationMs: number;
  /**
   * Letrero a mostrar al entrar al beat; '' = mantener el letrero anterior
   * (evita re-fade del mismo texto entre beats).
   */
  caption: string;
}

/**
 * Los beats de la cinemática en orden de reproducción (acto 1: laboratorio;
 * acto 2: callejón). La escena arranca SIEMPRE en el índice 0; el cierre
 * (wipe de niebla → NARRATIVE) se dispara al completarse el ÚLTIMO beat de
 * la tabla — por eso añadir beats es solo insertarlos aquí + su player.
 */
export const INTRO_BEATS: readonly IntroBeat[] = [
  {
    id: IntroBeatId.Entrance,
    durationMs: 3000,
    caption: INTRO_CAPTIONS.entrance,
  },
  {
    id: IntroBeatId.Drink,
    durationMs: 3000,
    caption: '', // mantiene el letrero de la entrada
  },
  {
    id: IntroBeatId.Transformation,
    durationMs: 3900,
    caption: INTRO_CAPTIONS.transformation,
  },
  {
    id: IntroBeatId.AlleyWalk,
    durationMs: 3000,
    caption: INTRO_CAPTIONS.alleyWalk,
  },
  {
    id: IntroBeatId.GirlAppears,
    durationMs: 3000,
    caption: INTRO_CAPTIONS.girlAppears,
  },
  {
    id: IntroBeatId.Menace,
    durationMs: 3800,
    caption: INTRO_CAPTIONS.menace,
  },
  {
    id: IntroBeatId.PlayerIsHyde,
    durationMs: 3400,
    caption: INTRO_CAPTIONS.playerIsHyde,
  },
];

/** Índice del siguiente beat; -1 si el actual es el último (cierra la intro). */
export function nextBeatIndex(index: number): number {
  if (index < 0 || index >= INTRO_BEATS.length - 1) {
    return -1;
  }
  return index + 1;
}

/** True si el índice apunta al ÚLTIMO beat (su fin dispara el cierre). */
export function isLastBeat(index: number): boolean {
  return nextBeatIndex(index) < 0 && index >= 0 && index < INTRO_BEATS.length;
}

// ---- 3. Config de animación por beat (los tweens viven en la escena) --------

/** Beat «Entrance»: aparición suave de Jekyll (fade + pop de escala). */
export const INTRO_ENTRANCE = {
  /** Duración del fade-in (ms). */
  fadeMs: 700,
  /** Escala inicial relativa a la base (pop con Back.easeOut hacia 1). */
  scaleFrom: 0.92,
} as const;

/**
 * Beat «Drink»: inclinación del sprite (el lado del frasco, la DERECHA de la
 * textura, sube con rotación antihoraria), mini-puff verde del trago y
 * pausa dramática antes del siguiente beat.
 */
export const INTRO_DRINK = {
  /** Rotación objetivo en rad (negativa = levanta el lado del frasco). */
  tiltRad: -0.32,
  /** Duración de la inclinación (ms). */
  tiltMs: 520,
  /** Pausa con el frasco en alto (ms) — el trago sugerido. */
  holdMs: 900,
  /** Duración de la vuelta a la posición recta (ms). */
  returnMs: 480,
  /** Puff que asciende del frasco a la boca (el trago). */
  gulp: { color: labGreen, scale: 0.35, durationMs: 420 },
} as const;

/**
 * Beat «Transformation»: el corazón de la cinemática. Secuencia orquestada
 * por la escena con estos parámetros: flash fullscreen → sacudida de cámara
 * + temblor del sprite → puffs de niebla teñida → crossfade Jekyll→Hyde con
 * pop de escala → halo púrpura que se disipa.
 */
export const INTRO_TRANSFORMATION = {
  /** Flash fullscreen (rectángulo del color, alfa 0 → pico → 0 en yoyo). */
  flash: { color: labGreen, peakAlpha: 0.8, durationMs: 460 },
  /** Sacudida de cámara (`camera.shake`). */
  shake: { durationMs: 520, intensity: 0.012 },
  /** Temblor del sprite de Jekyll (vaivén horizontal de poca amplitud). */
  tremble: { durationMs: 60, amplitudePx: 5, repeats: 4 },
  /** Puffs de niebla alrededor del personaje (anillo determinista). */
  puffs: {
    /** Presupuesto de niebla (SPEC §10.4 ≤ 30): puffs + slots del fondo. */
    count: 8,
    radiusPx: 150,
    scale: 1.1,
    durationMs: 760,
    staggerMs: 55,
    /** Tintes alternados de los puffs (resabio verde/púrpura de la poción). */
    tints: [labGreen, potionPurple],
  },
  /** Retardo del crossfade tras arrancar el flash (ms). */
  crossfadeDelayMs: 240,
  /** Duración del crossfade en espejo Jekyll→Hyde (ms). */
  crossfadeMs: 720,
  /** Pop de escala con el que Hyde «estalla» al materializarse. */
  pop: { fromFactor: 0.86, durationMs: 340 },
  /** Halo púrpura que se disipa tras revelar a Hyde. */
  halo: {
    color: potionPurple,
    startAlpha: 0.5,
    fromScale: 1.2,
    toScale: 2.6,
    durationMs: 950,
  },
} as const;

// ---- 3b. Config de animación del ACTO 2 (el callejón) -----------------------

/**
 * Beat «AlleyWalk»: troca al callejón (`LORE_BACKGROUNDS.alley`, con velo de
 * noche) y Hyde CRUZA el escenario de izquierda a derecha — la textura mira
 * a la derecha, así que entra por la IZQUIERDA sin voltear. Emergiendo de la
 * niebla (fade-in sobre el velo del trocado de fondo) con vaivén de paso.
 */
export const INTRO_ALLEY_WALK = {
  /** X inicial: fuera del lienzo por la izquierda (mitad de textura ≈ 122 px). */
  fromX: -140,
  /** X donde se detiene (centro-izquierda; deja la esquina derecha a la niña). */
  toX: 280,
  /** Duración del cruce (ms; Sine.easeInOut). */
  walkMs: 1900,
  /** Emergencia de la niebla: fade-in al empezar a andar (ms). */
  emergeMs: 500,
  /** Vaivén del paso: bob vertical y balanceo mínimo de rotación. */
  bob: { px: 7, cycleMs: 560 },
  rockRad: 0.035,
  /**
   * Vaivén del BRAZO articulado (`hyde-arm`) acompañando el paso: oscila
   * alrededor del hombro con el mismo ciclo del bob — el caminar se lee en
   * todo el cuerpo, no solo en la deriva del sprite.
   */
  arm: { swayRad: 0.3, cycleMs: 560 },
} as const;

/**
 * Beat «GirlAppears»: la niña entra por la DERECHA (la esquina junto a la
 * única farola del callejón) con su farol encendido — volteada (flipX) para
 * que la luz quede DEL LADO DE HYDE — y se detiene con el farol temblando.
 */
export const INTRO_GIRL_APPEARS = {
  /** X inicial: fuera del lienzo por la derecha. */
  fromX: 840,
  /** Duración de la entrada hasta su marca (ms; Sine.easeOut: llega y frena). */
  enterMs: 1000,
  /** Temblor del farol: vaivén sutil de rotación al detenerse. */
  tremble: { rad: 0.03, cycleMs: 130 },
  /** Resplandor del farol: puff cálido que respira tras la lámpara. */
  glow: { color: lampFire, scale: 0.9, alpha: 0.3, breatheMs: 900 },
} as const;

/**
 * Beat «Menace»: Hyde la ve (destello verde del ojo), avanza acechando y
 * ALZA EL BRAZO (el brazo ARTICULADO gira desde el hombro con Back.easeOut:
 * el látigo del gesto se lee con un overshoot y queda en alto). Amenaza
 * SUGERIDA, público 10+: el acercamiento NUNCA la alcanza, el golpe nunca
 * cae y la niña solo se encoge (queda «asustada pero ilesa», lore del quiz).
 */
export const INTRO_MENACE = {
  /** Pausa inicial: Hyde la ve antes de moverse (ms). */
  seeDelayMs: 520,
  /**
   * Destello del ojo (un puff teñido de verde, sube y baja en yoyo):
   * `durationMs` es el tiempo de CADA tramo (el yoyo completa 2 tramos).
   */
  eyeFlare: { color: labGreen, scale: 0.3, durationMs: 320 },
  /** Acecho: avanza hacia ella acelerando (Quad.easeIn) sin alcanzarla. */
  lunge: { toX: 415, durationMs: 820 },
  /** Inclinación del torso hacia adelante durante el acecho (encorvamiento). */
  hunchRad: 0.1,
  /**
   * Alza el brazo ARTICULADO: rotación desde el hombro (~80°, casi horizontal
   * apuntando a la niña — el brazo queda BIEN en alto, mucho más legible que
   * una inclinación de cuerpo entero) y aún PARCIAL: el golpe jamás cae.
   */
  armRaise: { rad: -1.4, durationMs: 620 },
  /** La niña se encoge: retroceso corto tras empezar el acecho. */
  flinch: { toX: 600, delayMs: 420, durationMs: 300 },
  /** Temblor de la niña: compresión vertical sutil (se hace pequeña). */
  tremble: { scaleY: 0.94, cycleMs: 240, repeats: 3 },
  /** Puffs de niebla que levanta el acecho (tras sus pies, deterministas). */
  puffs: { count: 2, scale: 0.9, durationMs: 780, staggerMs: 340 },
} as const;

/**
 * Beat «PlayerIsHyde»: cierre atmosférico — la niebla crece (velo + puffs),
 * el letrero final dirige al JUGADOR y, al completarse este beat, el flujo
 * existente cierra con el wipe hacia NARRATIVE (no se duplica aquí). El
 * brazo de Hyde queda EN ALTO (un pelín más relajado que el alzo), con una
 * respiración sutil: la amenaza congelada sigue viva. El golpe nunca cae.
 */
export const INTRO_PLAYER_IS_HYDE = {
  /** Pose congelada del brazo (algo menor que el alzo del acecho). */
  armHoldRad: -1.25,
  /** Respiración del brazo en alto (vaivén de rotación alrededor de la pose). */
  armBreatheRad: 0.05,
  /** Velo de niebla que espesa la escena (sobre los personajes, bajo el letrero). */
  veil: { color: fogNear, alpha: 0.32, durationMs: 1600 },
  /** Puffs de niebla creciendo por toda la escena (la que «lo cubre todo»). */
  puffs: { count: 5, scale: 2.4, durationMs: 1500, staggerMs: 180 },
} as const;

// ---- 4. Layout de la escena (sobre el lienzo base 720×1280) ------------------

/**
 * Composición de la escena: el fondo «lab» (`LORE_BACKGROUNDS.lab`: capas de
 * vapor + mesa + frascos) ocupa depths 0–7; los personajes pisan depth 8; el
 * letrero pergamino y la UI van encima; el flash de la transformación cubre
 * TODO lo de la escena (bajo la cortina del wipe, depth 1000).
 */
export const INTRO_SCENE_LAYOUT = {
  /** Centro y escala base de Jekyll/Hyde (delante de la mesa del laboratorio). */
  character: { x: BASE_WIDTH / 2, y: 660, scale: 1.7, depth: 8 },
  /**
   * La niña (acto 2): la «esquina» junto a la única farola del callejón,
   * MÁS PEQUEÑA y MÁS ALTA que Hyde en pantalla (más lejos: profundidad de
   * escena). Depth entre el velo de trocado (7.5) y los personajes (8): si
   * llegaran a solaparse, ella queda detrás.
   */
  girl: { x: 560, y: 640, scale: 1.25, depth: 7.8 },
  /** Velos de trocado de fondo (fase 2): entre los props (7) y los personajes (8). */
  backgroundVeilDepth: 7.5,
  /**
   * Velo de niebla del cierre (acto 2): sobre los personajes (8) y bajo el
   * letrero (10) — el mensaje final se lee a través de la niebla.
   */
  closingVeilDepth: 9,
  /** Letrero pergamino inferior (estilo del panel narrativo, más compacto). */
  caption: {
    x: BASE_WIDTH / 2,
    y: 1120,
    panelWidth: 640,
    panelHeight: 150,
    depth: 10,
    fadeMs: 340,
    lineSpacing: 8,
    style: {
      fontFamily: '"Crimson Text", Georgia, serif',
      fontSize: 32,
      // Tinta sepia sobre el pergamino CLARO de `parchment-frame` (~9:1 de
      // contraste, SPEC §9) — mismo patrón que «Cómo jugar» y GAME_OVER.
      color: parchmentDark,
      /** Ancho de wrap del letrero (panel − 2·padding ≈ 560 px). */
      wordWrapWidth: 560,
    },
  },
  /** Botón «Saltar» (misma esquina y estilo que `NARRATIVE_SKIP_BUTTON`). */
  skipButton: { x: BASE_WIDTH - 40 - 110, y: 96, depth: 12 },
  /**
   * Flechas de navegación al COSTADO (adelante/atrás ENTRE BEATS): mismo
   * estilo y comportamiento que las de la narrativa — la navegación es la
   * misma en toda la historia. Van MÁS ARRIBA que en la narrativa (y = 420):
   * aquí los personajes actúan a y ≈ 660 y la niña se encoge hacia la
   * esquina derecha — a media pantalla la flecha pisaría la escena.
   */
  nav: {
    marginX: 52,
    y: 420,
    scale: 0.9,
    disabledAlpha: 0.28,
    pressedScale: 0.85,
    depth: 12,
  },
  /** Profundidad del flash de la transformación (sobre toda la escena). */
  flashDepth: 30,
  /** Duración del velo de trocado de fondo (ms; solo fase 2 lo usa). */
  backgroundSwapMs: 320,
} as const;

// ---- 5. Destino --------------------------------------------------------------

/**
 * Nivel al que se llega al terminar (o saltar) la intro: el 1 — la narrativa
 * continúa EXACTAMENTE donde la intro deja la historia. (Que el id exista en
 * `LEVELS` lo garantiza el test de `intro.test.ts`.)
 */
export const INTRO_TARGET_LEVEL_ID = 1;

/** Claves de textura que consume la escena (referencia testeable). */
export const INTRO_TEXTURES = {
  jekyll: TEXTURE_KEYS.jekyll,
  hyde: TEXTURE_KEYS.hyde,
  arm: TEXTURE_KEYS.hydeArm,
  girl: TEXTURE_KEYS.girl,
  puff: TEXTURE_KEYS.fogPuff,
  halo: TEXTURE_KEYS.fog,
  captionPanel: TEXTURE_KEYS.parchmentFrame,
} as const satisfies Record<string, string>;

/** Color de un tinte de puff según su índice (alternancia determinista). */
export function puffTintFor(index: number): HexColor {
  const tints = INTRO_TRANSFORMATION.puffs.tints;
  return tints[index % tints.length] as HexColor;
}

/**
 * Puffs unitarios (1 sprite de niebla cada uno): el trago del frasco
 * (`spawnGulp`), el resplandor del farol y el destello del ojo de Hyde.
 */
const SINGLE_PUFF_BEATS = 3;

/**
 * Presupuesto de niebla de la CINEMÁTICA (SPEC §10.4 ≤ 30): todos los sprites
 * de niebla transitorios que los players pueden crear en un paseo completo,
 * para sumar a los slots del fondo vigente (el test de `intro.test.ts` lo
 * chequea contra el tope).
 */
export function introFogSprites(): number {
  return (
    INTRO_TRANSFORMATION.puffs.count +
    SINGLE_PUFF_BEATS +
    INTRO_MENACE.puffs.count +
    INTRO_PLAYER_IS_HYDE.puffs.count
  );
}
