/**
 * Modo debug (PLAN Etapa 4/§7): activable por query-param `?debug`.
 *
 * Lo consume `ActionScene` para el contador de FPS en pantalla (CA de
 * perf: FPS ≥ 55 en móvil real — se MIDE en la Etapa 7). Función pura sobre
 * el string de búsqueda para que sea testeable sin navegador.
 *
 * Con `?debug` ausente la escena ni siquiera crea el objeto de texto:
 * costo cero cuando está apagado.
 */

/**
 * ¿El query-string activa el modo debug? Solo la PRESENCIA de la clave
 * `debug` cuenta (`?debug`, `?debug=1`, `?a=b&debug`); `?debugfoo` o
 * `?x=debug` NO activan nada.
 */
export function debugEnabled(search: string): boolean {
  return new URLSearchParams(search).has('debug');
}
