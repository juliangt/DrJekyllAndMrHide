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
 * Mecánica del Nivel 1 (v1): tap/clic sobre un objetivo errático dentro de
 * un tiempo límite (SPEC §4.2). Las mecánicas futuras (N2 `chase-escape`,
 * N3 `collect-falling`, SPEC §12) se suman a la unión `ActionConfig`.
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

/** Unión discriminada por `mechanic`: la mecánica de acción del nivel. */
export type ActionConfig = TapTargetActionConfig;

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
