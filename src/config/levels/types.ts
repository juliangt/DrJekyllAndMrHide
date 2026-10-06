/**
 * Tipos de datos de niveles (SPEC §10.3, data-driven): `LevelConfig`,
 * `LorePanel`, unión discriminada `ActionConfig` (por `mechanic`) y
 * `QuizConfig`. Todo el contenido de un nivel es DATOS, no código:
 * añadir niveles = añadir archivos de configuración (decisión D3).
 *
 * Sin import de Phaser: puro tipado para que los datos sean testeables.
 */

/**
 * Fondo procedural por panel narrativo (SPEC §10.3: «texto + fondo
 * procedural por panel»). Unión de literales: qué pintada de escena usa
 * `NarrativeScene` como fondo del panel — callejón, laboratorio o calle.
 */
export type LoreBackground = 'alley' | 'lab' | 'street';

/** Un panel/viñeta de la fase narrativa (SPEC §4.1: ≤ 40 palabras). */
export interface LorePanel {
  /** Texto del panel (≤ 40 palabras, vocabulario 10+, SPEC §9). */
  text: string;
  /** Qué fondo procedural pinta la escena bajo el texto. */
  background: LoreBackground;
}

/**
 * Mecánica del Nivel 1: tap/clic sobre un objetivo errático dentro de
 * un tiempo límite (SPEC §4.2).
 */
export interface TapTargetActionConfig {
  mechanic: 'tap-target';
  /** Configuración del objetivo que se persigue. */
  target: {
    /**
     * Clave de la textura procedural del objetivo.
     * N1: 'girl' (silueta de la niña con farol; se genera en la Etapa 4).
     */
    texture: string;
    /** Rango de velocidad en px/s: [mín, máx] (N1: [120, 180]). */
    speedRange: [number, number];
    /** Rango del intervalo de cambio aleatorio de dirección en ms (N1: [800, 1500]). */
    dirChangeMs: [number, number];
  };
  /** Taps exitosos requeridos (N1: 3). */
  goal: number;
  /** Tiempo límite en segundos (N1: 45). */
  timeLimitSec: number;
  /** Etiqueta del contador en el HUD (N1: «Sustos causados»). */
  hudLabel: string;
}

/**
 * Mecánica del Nivel 2: golpear con un bastón de mango blanco a un objetivo
 * que HUYE erráticamente más rápido que el del N1 (episodio del Dr. Lanyon).
 * El «bastonazo» es un verbo de juego caricaturesco (público 10+, D4): nadie
 * sufre daño visible — el objetivo escapa entre la niebla.
 */
export interface CaneStrikeActionConfig {
  mechanic: 'cane-strike';
  /** Configuración del objetivo que HUYE erráticamente (más veloz que el N1). */
  target: {
    /**
     * Clave de la textura procedural del objetivo.
     * N2: 'lanyon' (el Dr. Lanyon; Fase 2 genera la textura — se fija la
     * clave aquí para que config y arte no se desincronicen, como 'girl').
     */
    texture: string;
    /** Rango de velocidad en px/s: [mín, máx] (N2: [150, 220], > N1). */
    speedRange: [number, number];
    /** Rango del intervalo de cambio aleatorio de dirección en ms (N2: [600, 1200]). */
    dirChangeMs: [number, number];
  };
  /** Bastonazos con el bastón requeridos (N2: 5). */
  goal: number;
  /** Tiempo límite en segundos (N2: 60). */
  timeLimitSec: number;
  /** Etiqueta del contador en el HUD (N2: «Bastonazos»). */
  hudLabel: string;
  /** Clave de la textura del bastón de mango BLANCO que esgrime Hyde (Fase 2). */
  caneTexture: string;
  /** Grito de Hyde cuando cae el objetivo (se muestra tras el golpe final). */
  victoryLine: string;
}

/**
 * Mecánica del Nivel 3: el objetivo ALTERNA Hyde↔Jekyll (asedio al
 * laboratorio). Solo los impactos sobre Hyde cuentan: tras cada golpe Hyde
 * se vuelve Jekyll (invulnerable) durante `revertMs`, así que el jugador
 * debe esperar la ventana y apuntar bien — puntería sobre velocidad.
 */
export interface TransformTargetActionConfig {
  mechanic: 'transform-target';
  /** Configuración del objetivo que alterna de forma. */
  target: {
    /** Clave de la textura en forma Hyde ('hyde', ya existe en la intro). */
    textureHyde: string;
    /** Clave de la textura en forma Jekyll ('jekyll', ya existe en la intro). */
    textureJekyll: string;
    /** Rango de velocidad en px/s: [mín, máx] (N3: [110, 170]). */
    speedRange: [number, number];
    /** Rango del intervalo de cambio aleatorio de dirección en ms (N3: [700, 1300]). */
    dirChangeMs: [number, number];
  };
  /** Tras CADA golpe, Hyde se vuelve Jekyll (invulnerable) este tiempo en ms. */
  revertMs: number;
  /** Golpes a Hyde requeridos (N3: 6). */
  goal: number;
  /** Tiempo límite en segundos (N3: 90). */
  timeLimitSec: number;
  /** Etiqueta del contador en el HUD (N3: «Golpes a Hyde»). */
  hudLabel: string;
}

/**
 * Unión discriminada por `mechanic`: la mecánica de acción del nivel.
 * N1 `tap-target` (sustos), N2 `cane-strike` (bastonazos), N3
 * `transform-target` (golpes a Hyde entre transformaciones).
 */
export type ActionConfig = TapTargetActionConfig | CaneStrikeActionConfig | TransformTargetActionConfig;

/** Una opción del quiz (SPEC §4.3: A–D, feedback pedagógico SIEMPRE). */
export interface QuizOption {
  /** Texto de la opción (verbatim del material fuente). */
  text: string;
  /** Marcador de la opción correcta (exactamente una por quiz). */
  correct?: boolean;
  /** Feedback pedagógico mostrado al elegirla (correcta o no). */
  feedback: string;
}

/** Fase de evaluación literaria (SPEC §4.3). */
export interface QuizConfig {
  question: string;
  options: QuizOption[];
  /** Fragmento de historia mostrado al acertar (SPEC §4.4). */
  storyFragment: string;
}

/** TODO el contenido de un nivel como datos (SPEC §10.3). */
export interface LevelConfig {
  id: number;
  title: string;
  /** Viñeta narrativa: paneles en orden de lectura. */
  lore: LorePanel[];
  /** Mecánica arcade (unión discriminada por `mechanic`). */
  action: ActionConfig;
  /** Evaluación literaria post-acción. */
  quiz: QuizConfig;
}
