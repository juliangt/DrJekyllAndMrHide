/**
 * Registro ordenado de niveles (SPEC §10.3): las escenas genéricas
 * (Narrative/Action/Quiz) leen de aquí el `LevelConfig` activo.
 * Los tres niveles del arco (N1 el cheque, N2 Lanyon, N3 el asedio) están
 * registrados; añadir más = añadir archivos y sumarlos a `LEVELS` (D3).
 */
import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import type { LevelConfig } from './types';

/** Niveles registrados, en orden de juego (ids únicos). */
export const LEVELS: readonly LevelConfig[] = [level1, level2, level3];

/**
 * Devuelve el nivel con ese `id`, o `undefined` si no está registrado.
 * (v1.1: `getLevel(1|2|3)` cubren el arco completo del juego.)
 */
export function getLevel(id: number): LevelConfig | undefined {
  return LEVELS.find((level) => level.id === id);
}
