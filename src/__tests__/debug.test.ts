/**
 * Etapa 4 — test del modo debug por query-param (`?debug`): la llave
 * correcta activa, las casi-llaves NO, y sin query no hay costo.
 */
import { describe, expect, it } from 'vitest';
import { debugEnabled } from '../config/debug';

describe('debugEnabled — activación por query-param', () => {
  it.each(['?debug', '?debug=1', '?debug=true', '?a=b&debug', '?debug&x=1'])(
    '%s activa el modo debug',
    (search) => {
      expect(debugEnabled(search)).toBe(true);
    },
  );

  it.each(['', '?foo=bar', '?debugfoo', '?x=debug', '?debugging=1'])(
    '%s NO activa nada',
    (search) => {
      expect(debugEnabled(search)).toBe(false);
    },
  );
});
