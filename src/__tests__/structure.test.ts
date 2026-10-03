/**
 * Etapa 0 — test de humo de estructura: verifica que la arquitectura de
 * carpetas de la SPEC §10.2 existe (placeholders incluidos), leyendo el
 * filesystem directamente desde el test.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

/** Archivos esperados bajo src/ según SPEC §10.2 (más dimensions.ts, añadido en Etapa 0; más intro.ts e IntroScene.ts, añadidos en la cinemática pre-nivel). */
const EXPECTED_FILES: string[] = [
  // bootstrap
  'src/main.ts',
  // config
  'src/config/dimensions.ts',
  'src/config/palette.ts',
  'src/config/game.config.ts',
  'src/config/intro.ts',
  'src/config/levels/types.ts',
  'src/config/levels/level1.ts',
  'src/config/levels/index.ts',
  // scenes (las del flujo de estados, SPEC §3)
  'src/scenes/BootScene.ts',
  'src/scenes/PreloadScene.ts',
  'src/scenes/MenuScene.ts',
  'src/scenes/IntroScene.ts',
  'src/scenes/NarrativeScene.ts',
  'src/scenes/ActionScene.ts',
  'src/scenes/QuizScene.ts',
  'src/scenes/VictoryScene.ts',
  // systems
  'src/systems/SaveSystem.ts',
  'src/systems/AudioSystem.ts',
  'src/systems/ScoreSystem.ts',
  // ui
  'src/ui/GothicButton.ts',
  'src/ui/Panel.ts',
  'src/ui/Modal.ts',
  'src/ui/Hud.ts',
  // art
  'src/art/textures.ts',
];

describe('estructura de carpetas (SPEC §10.2)', () => {
  it('declara los 24 archivos esperados', () => {
    expect(EXPECTED_FILES.length).toBe(24);
  });

  it.each(EXPECTED_FILES)('existe %s', (relativePath) => {
    const absolutePath = resolve(projectRoot, relativePath);
    expect(existsSync(absolutePath), `debería existir ${absolutePath}`).toBe(true);
  });
});
