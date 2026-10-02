/**
 * Claves de las escenas del flujo (SPEC §3).
 *
 * OCHO estados en el flujo, pero SOLO SIETE archivos de escena (SPEC §10.2):
 * `GAME_OVER` NO tiene escena propia — es un OVERLAY dibujado dentro de
 * `ActionScene` cuando el timer llega a cero (SPEC §3: «timeout → GAME_OVER
 * → reintentar ACTION»). Su clave existe aquí porque el mapa de navegación
 * (`src/scenes/sceneNav.ts`) lo modela como nodo del grafo igual que al resto.
 *
 * NOTA — «enum»: `tsconfig` usa `erasableSyntaxOnly: true`, que prohíbe los
 * `enum` de TypeScript (generan código en runtime). Este objeto `const` +
 * unión de tipos derivada es el equivalente borra-safe (enum pattern), con
 * los mismos beneficios: nombres agrupados, autocompletado y exhaustividad.
 *
 * Vive en su propio módulo (y no en `game.config.ts`) para evitar el ciclo de
 * imports `escenas → game.config → escenas`; `game.config.ts` lo re-exporta.
 *
 * Sin import de Phaser: se consume en tests.
 */
export const SceneKey = {
  /** Init: texturas procedurales + sistemas. → PRELOAD. */
  BOOT: 'Boot',
  /** Fuentes web (Google Fonts) con timeout y fallback serif. → MENU. */
  PRELOAD: 'Preload',
  /** Splash gótico con botones y toggle de mute. → NARRATIVE. */
  MENU: 'Menu',
  /** Viñeta del nivel: paneles de lore, avance por tap. → ACTION. */
  NARRATIVE: 'Narrative',
  /** Minijuego arcade del nivel. meta → QUIZ · timeout → GAME_OVER (overlay). */
  ACTION: 'Action',
  /** OVERLAY dentro de ActionScene (timeout): «Reintentar» → ACTION. */
  GAME_OVER: 'GameOver',
  /** Quiz literario. ✔ → VICTORY · ✘ → reinicio de nivel → NARRATIVE. */
  QUIZ: 'Quiz',
  /** Diploma + resumen de puntaje. → MENU. */
  VICTORY: 'Victory',
} as const;

/** Unión de las 8 claves de escena (usar como tipo en firmas y mapas). */
export type SceneKey = (typeof SceneKey)[keyof typeof SceneKey];
