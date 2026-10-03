/**
 * Hitbox del objetivo (SPEC §4.2): GEOMETRÍA PURA.
 *
 * «Hitbox generosa: +20 % del sprite, apropiada para dedos de niños»: un tap
 * acierta si cae dentro del rectángulo del sprite EXPANDIDO 1.2× (centro
 * idéntico, lados × 1.2). La escena compara contra el CENTRO LÓGICO del
 * objetivo (su estado errático), no contra el render con bob — la oscilación
 * visual (±4 px) queda holgadamente dentro de la expansión.
 *
 * Sin import de Phaser: puntos y cajas son datos planos.
 */

/** Un punto de tap (posición del puntero en coordenadas del mundo). */
export interface PointLike {
  x: number;
  y: number;
}

/** Caja del objetivo: CENTRO + tamaño de despliegue (px). */
export interface TargetLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Expansión de la hitbox respecto al sprite (SPEC §4.2: +20 %).
 * 1 = hitbox exacta al sprite; 1.2 = la generosa del Nivel 1.
 */
export const DEFAULT_HITBOX_EXPANSION = 1.2;

/**
 * Caja expandida de un target: mismo centro, lados multiplicados por
 * `expansion` (por defecto +20 %). Función total: también sirve para
 * visualizar/debuggear la hitbox.
 */
export function expandedTarget(
  target: TargetLike,
  expansion: number = DEFAULT_HITBOX_EXPANSION,
): TargetLike {
  return {
    x: target.x,
    y: target.y,
    width: target.width * expansion,
    height: target.height * expansion,
  };
}

/**
 * ¿El punto cayó dentro de la hitbox expandida del objetivo? (Bordes
 * INCLUIDOS — generosa también en la frontera.)
 */
export function isHit(
  point: PointLike,
  target: TargetLike,
  expansion: number = DEFAULT_HITBOX_EXPANSION,
): boolean {
  const box = expandedTarget(target, expansion);
  const halfW = box.width / 2;
  const halfH = box.height / 2;
  return (
    point.x >= target.x - halfW &&
    point.x <= target.x + halfW &&
    point.y >= target.y - halfH &&
    point.y <= target.y + halfH
  );
}
