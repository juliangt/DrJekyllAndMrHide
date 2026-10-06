/**
 * Layout de la escena de acción (PLAN Etapa 4 / SPEC §6, §9): DATOS PUROS.
 * `ActionScene`, `ui/Hud` y `ui/TimerBar` solo CONSUMEN esta tabla — así la
 * composición completa es testeable sin Phaser contra el lienzo base
 * 720×1280 (mobile-first, SPEC §9).
 *
 * Coherencia garantizada (y testeada):
 *  - La ZONA DE JUEGO (`playZone`, límites del CENTRO de la niña) deja fuera
 *    la banda del HUD superior (`hudHeight`) y el suelo (`groundY`): la niña
 *    rebota dentro del callejón, no bajo los contadores ni tras los
 *    adoquines (SPEC §4.2 «rebota en los bordes de la zona de juego»).
 *  - El sprite de la niña con su hitbox +20 % cabe por completo en el lienzo
 *    en cualquier posición de la zona.
 *  - Depths: capas parallax (1–5) < niña < efectos < HUD < overlay
 *    GAME_OVER (la niebla nunca tapa la UI, SPEC §9).
 */

import {
  ACTION_PARALLAX_LAYERS,
  LAB_PARALLAX_LAYERS,
  STREET_LINE_Y,
} from '../art/parallax';
import type { HexColor } from '../config/palette';
import {
  buildings,
  error,
  lampFire,
  parchmentDark,
  parchmentLight,
  street,
  success,
  textPrimary,
} from '../config/palette';
import type { ButtonLayout } from '../ui/buttonState';
import { ButtonVisualState } from '../ui/buttonState';
import type { ErraticBounds } from './erraticMovement';

/** Límites de la zona de juego para el CENTRO de la niña (px). */
export interface PlayZone extends ErraticBounds {}

/**
 * Composición completa de ACTION sobre 720×1280 (datos; ver tests de
 * coherencia en `__tests__/actionLayout.test.ts`).
 */
export const ACTION_LAYOUT = {
  /** Banda superior reservada al HUD: la niña nunca entra aquí. */
  hudHeight: 260,
  /** Línea de calle (comparte STREET_LINE_Y con menú/narrativa). */
  groundY: STREET_LINE_Y,

  /** Zona de juego (rebote de la niña): callejón entre HUD y suelo. */
  playZone: {
    minX: 96,
    maxX: 624,
    minY: 380,
    maxY: 980,
  } as const satisfies PlayZone,

  /** Tamaño de DESPLIEGUE de la niña (px; la textura base es 96×176). */
  girl: {
    width: 120,
    height: 220,
  },

  /** Elementos del HUD (coordenadas absolutas sobre 720×1280). */
  hud: {
    /** «Sustos causados: X/3» (esquina superior izquierda). */
    counter: { x: 40, y: 84 },
    /** Barra del timer (bajo el contador, anclada a la izquierda). */
    timerBar: { x: 40, y: 156, width: 520, height: 18 },
    /** Segundos numéricos (a la derecha de la barra). */
    timerSeconds: { x: 584, y: 156 },
    /** Puntaje vivo «Puntaje: N» (bajo la barra). */
    score: { x: 40, y: 216 },
    /** Botón pausa (esquina superior derecha; vuelve a Menu, SPEC §6). */
    pause: { x: 636, y: 84 },
  },

  /** Profundidades de pintado (props < niebla < objetivo < efectos < HUD < overlay). */
  depths: {
    /** Props de la mecánica (puerta del lab, mesa, Poole/Utterson de fondo). */
    props: 4.6,
    /** Aura púrpura de la transformación (detrás del objetivo, sobre la niebla). */
    aura: 5.6,
    /** El objetivo (niña/Lanyon/Hyde): por encima de TODA la niebla. */
    girl: 6,
    /** Puffs de niebla (tap al aire), estallidos y swing del bastón. */
    effects: 7,
    /** «!», «+10», bonus de tiempo (feedback flotante). */
    feedback: 8,
    /** HUD (contador, timer, puntaje, pausa). */
    hud: 10,
    /** Carátula de la línea de victoria de Hyde (N2), bajo el overlay. */
    victory: 20,
    /** Overlay GAME_OVER (timeout): por encima de todo. */
    overlay: 50,
  },

  /** Tipografía del contador y del puntaje (Special Elite, SPEC §7.3). */
  hudTextStyle: {
    fontFamily: '"Special Elite", Georgia, serif',
    fontSize: 32,
    color: textPrimary,
  },

  /** Colores de la barra de timer: fuego de farola → rojo desaturado. */
  timerColors: {
    /** Normal: vela cálida (paleta §7.1). */
    fill: lampFire,
    /** Ventana crítica (últimos 5 s): rojo desaturado, no agresivo. */
    critical: error,
    /** Pista de fondo de la barra. */
    track: parchmentDark,
    /** Texto de segundos. */
    text: textPrimary,
  },
} as const;

/**
 * Botón «Pausa»: compacto (168×72 ≥ 64 px táctil, SPEC §9), marco pergamino.
 * Vuelve a Menu guardando progreso (SPEC §6).
 */
export const ACTION_PAUSE_BUTTON: { label: string; layout: ButtonLayout } = {
  label: 'Pausa',
  layout: {
    minWidth: 168,
    height: 72,
    cornerRadius: 14,
    paddingX: 20,
    fontSize: 26,
    fontFamily: '"Special Elite", Georgia, serif',
    states: {
      [ButtonVisualState.Idle]: { fill: parchmentDark, stroke: parchmentLight, text: textPrimary },
      [ButtonVisualState.Hover]: { fill: parchmentDark, stroke: parchmentLight, text: lampFire },
      [ButtonVisualState.Pressed]: { fill: parchmentDark, stroke: parchmentLight, text: lampFire },
    },
  },
};

// ---- Feedback del tap ---------------------------------------------------------

/** Timing del feedback de tap (ms) — datos para los tests de coherencia. */
export const ACTION_FEEDBACK = {
  /** Flash blanco de cámara (SPEC §7.2 «flash blanco breve»). */
  flashMs: 120,
  /** Micro-shake de cámara: ≤ 150 ms, suave (SPEC §7.2). */
  shakeMs: 120,
  /**
   * Intensidad del shake (fracción del viewport): apenas un temblor.
   * Etapa 7 (pulido): 0.004 → 0.0035 — sigue leyéndose como «micro»
   * (SPEC §7.2) y no compite con el movimiento errático de la niña.
   */
  shakeIntensity: 0.0035,
  /** «!» y «+10» flotantes: suben y se desvanecen. */
  floatMs: 550,
  /** Puff de niebla del tap al aire: crece y se disipa. */
  puffMs: 420,
  /**
   * La niña «sale corriendo» tras el susto: mini-estallido y regreso.
   * Etapa 7 (pulido): 480 → 560 — se queda oculta MÁS tiempo del que tarda
   * el estallido de puffs en disiparse (puffMs + delay escalonado ≈ 540),
   * de modo que la niebla se limpia antes de que reaparezca.
   */
  scareMs: 560,
  /**
   * Huida final de la niña al lograr la meta (tween fuera de pantalla).
   * Etapa 7 (pulido): 750 → 850 — la huida es el pago emocional de la
   * tanda; un pelín más de tiempo la deja leerse completa.
   */
  fleeMs: 850,
  /**
   * Cola antes de arrancar el QUIZ tras la huida.
   * Etapa 7 (pulido): 1150 → 1250 — mantiene el colchón sobre fleeMs
   * (≥, testeado) y da margen al «+bonus» flotante (floatMs) antes del fade.
   */
  exitDelayMs: 1250,
} as const;

/** Estilo del «!» sobre la niña y del «+10» flotante. */
export const ACTION_FLOAT_STYLE = {
  exclamation: {
    fontFamily: '"Special Elite", Georgia, serif',
    fontSize: 46,
    color: lampFire,
  },
  points: {
    fontFamily: '"Special Elite", Georgia, serif',
    fontSize: 34,
    color: success,
  },
} as const;

// ---- Perf (SPEC §10.4: pool acotado) -----------------------------------------

/**
 * Presupuesto de sprites de niebla (SPEC §10.4: pool ≤ 30): las capas
 * parallax de la tabla ACTION + el pool de puffs transitorios del feedback
 * deben sumar ≤ MAX_FOG_SPRITES. Nada de generación de texturas por frame.
 */
export const MAX_FOG_SPRITES = 30;

/** Tamaño del pool de puffs de niebla (taps al aire + estallidos). */
export const PUFF_POOL_SIZE = 6;

/**
 * dt máximo por frame (ms): un stall del navegador (tab en background,
 * micro-freeze) NO devora el timer de golpe — el reloj del minijuego corre
 * como mucho a 100 ms por frame procesado.
 */
export const ACTION_DT_CAP_MS = 100;

/** Parámetros de la animación barata de caminar (bob/tilt, sin tweens). */
export const GIRL_WALK_BOB = {
  /** Vaivén vertical (px). */
  amplitudePx: 4,
  /** Velocidad angular del vaivén (rad/s). */
  speed: 9,
  /** Inclinación máxima (rad) — el balanceo del paso. */
  tiltRad: 0.045,
  /** Velocidad angular de la inclinación (rad/s). */
  tiltSpeed: 4.5,
} as const;

// ---- Fase 3: tamaños por objetivo y fondos por mecánica -----------------------

/**
 * Tamaño de DESPLIEGUE de cada objetivo (px) — las texturas de N2/N3 no
 * comparten el tamaño de la niña (N1). La hitbox +20 % se calcula SIEMPRE
 * sobre estos tamaños; todos mantienen el mínimo táctil ≥ 64 px (SPEC §9).
 * La clave es la textura; la mecánica elige la suya (girl/lanyon/hyde).
 */
export const ACTION_TARGET_SIZES = {
  /** La niña (N1): igual que `ACTION_LAYOUT.girl` (referencia compartida). */
  girl: { width: 120, height: 220 },
  /** El Dr. Lanyon (N2; textura base 128×208). */
  lanyon: { width: 122, height: 198 },
  /** Hyde (N3; textura base 144×240). */
  hyde: { width: 132, height: 220 },
  /** Jekyll (N3; textura base 128×224). */
  jekyll: { width: 120, height: 210 },
} as const;

/**
 * Fondo por mecánica (datos): el callejón de la noche para N1/N2 (misma
 * tabla `ACTION_PARALLAX_LAYERS` — N2 añade estrellas titilando) y el
 * interior del laboratorio para N3 (vapor púrpura/verde de `LAB_PARALLAX_
 * LAYERS` + props en `ActionScene`). El color del suelo cambia: adoquines
 * de calle fuera, madera/piedra oscura del lab dentro.
 */
export const ACTION_BACKGROUNDS: Readonly<
  Record<
    string,
    {
      layers: typeof ACTION_PARALLAX_LAYERS;
      groundColor: HexColor;
      stars: boolean;
    }
  >
> = {
  'tap-target': { layers: ACTION_PARALLAX_LAYERS, groundColor: street, stars: false },
  'cane-strike': { layers: ACTION_PARALLAX_LAYERS, groundColor: street, stars: true },
  'transform-target': { layers: LAB_PARALLAX_LAYERS, groundColor: buildings, stars: false },
} as const;

/**
 * Props del laboratorio para la mecánica 'transform-target' (N3, Fase 3):
 * la puerta asediada centrada, la mesa con frascos y los dos golpeatores
 * (Poole/Utterson) que golpean durante la intro y entran al final. Todo
 * tamaño de despliegue en px sobre el lienzo 720×1280.
 */
export const ACTION_LAB_PROPS = {
  /** Puerta del lab: centrada, apoyada en la línea de suelo. */
  door: { x: 360, y: 880, width: 220, height: 352, openAlpha: 0.16 },
  /** Mesa de laboratorio (esquina izquierda, bajo la zona de juego). */
  bench: { x: 122, y: 1008, width: 220, height: 92 },
  /** Frascos sobre la mesa (se tiñen con la paleta del lab). */
  flaskA: { x: 84, y: 944, width: 44, height: 66 },
  flaskB: { x: 158, y: 950, width: 38, height: 58 },
  /** Poole golpeando (izquierda de la puerta; entra por la derecha al final). */
  poole: { x: 172, y: 946, width: 116, height: 194 },
  /** Utterson golpeando (derecha de la puerta; entra por la izquierda al final). */
  utterson: { x: 548, y: 944, width: 120, height: 196 },
  /** Empujón de los golpeatores con cada golpe de puerta (px y ms). */
  knockLunge: { px: 6, ms: 70 },
} as const;

// ---- FPS debug (?debug, Etapa 7) ----------------------------------------------

/** Estilo del contador de FPS de debug (query-param `?debug`). */
export const FPS_DEBUG_STYLE = {
  fontFamily: '"Special Elite", Georgia, serif',
  fontSize: 24,
  color: success,
} as const;
