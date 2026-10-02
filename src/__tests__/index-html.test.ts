/**
 * Etapa 0 — test de index.html: viewport mobile-first y Google Fonts
 * según SPEC §7.3 / §9.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('index.html — viewport mobile (SPEC §9)', () => {
  it('tiene el meta viewport con width, initial-scale, maximum-scale y user-scalable', () => {
    expect(html).toContain(
      'content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"',
    );
  });
});

describe('index.html — tipografías Google Fonts (SPEC §7.3)', () => {
  it('hace preconnect a fonts.googleapis.com y fonts.gstatic.com', () => {
    expect(html).toContain('rel="preconnect" href="https://fonts.googleapis.com"');
    expect(html).toContain('href="https://fonts.gstatic.com"');
    expect(html).toContain('crossorigin');
  });

  it('enlaza la hoja de estilos css2 de Google Fonts', () => {
    expect(html).toContain('href="https://fonts.googleapis.com/css2?');
    expect(html).toContain('rel="stylesheet"');
  });

  it('incluye UnifrakturCook (títulos)', () => {
    expect(html).toContain('family=UnifrakturCook');
  });

  it('incluye Special Elite (cuerpo/typewriter)', () => {
    expect(html).toContain('family=Special+Elite');
  });

  it('incluye Crimson Text (bloques largos)', () => {
    expect(html).toContain('family=Crimson+Text');
  });
});

describe('index.html — metadatos de página', () => {
  it('declara idioma español y el título placeholder', () => {
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('Jekyll &amp; Hyde [TBD]');
  });
});
