/**
 * Registro ordenado de niveles (SPEC §10.3): las escenas genéricas
 * (Narrative/Action/Quiz) leen de aquí el `LevelConfig` activo.
 * Añadir niveles 2 y 3 (SPEC §12) = añadir archivos y sumarlos a `LEVELS`.
 */
import { level1 } from './level1';
import type { LevelConfig } from './types';

/** Niveles registrados, en orden de juego (ids únicos). */
export const LEVELS: readonly LevelConfig[] = [level1];

/**
 * Devuelve el nivel con ese `id`, o `undefined` si no está registrado.
 * (v1: `getLevel(1)` es el único nivel, decisión D3.)
 */
export function getLevel(id: number): LevelConfig | undefined {
  return LEVELS.find((level) => level.id === id);
}
