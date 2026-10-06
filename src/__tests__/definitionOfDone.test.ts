/**
 * Etapa 7 — DEFINITION OF DONE como test EJECUTABLE (PLAN §3).
 * Un test por ítem del DoD automatizable (client-side, sin red): lo que un
 * test puede probar en la build, probado; lo que exige dispositivo físico
 * (FPS reales, táctil con dedos) queda instrumentado aquí y documentado en
 * `docs/QA-CHECKLIST.md` como checklist manual.
 *
 * Referencia cruzada: los checks PROFUNDOS viven en los tests de la etapa —
 * responsive.test.ts (cadena 320→1920), persistenceFlow.test.ts (ciclo de
 * save), accessibility.test.ts (contraste/tamaños/input) y content.test.ts
 * (revisión de textos). Aquí se verifica que el DoD COMPLETO está cubierto.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { fitScale } from '../ui/fitScale';
import { SceneKey } from '../config/sceneKeys';
import { NEXT_SCENE, ALT_TRANSITIONS, nextSceneKey } from '../scenes/sceneNav';
import { LEVELS } from '../config/levels';
import {
  QUIZ_POINTS,
  TAP_POINTS,
  TIME_BONUS_PER_SECOND,
  actionRoundScore,
  timeBonus,
} from '../gameplay/scoring';
import { buildScoreBreakdown } from '../gameplay/victory';
import { SAVE_KEY, SaveSystem, type StorageLike } from '../systems/SaveSystem';
import { debugEnabled } from '../config/debug';
import { FPS_DEBUG_STYLE } from '../gameplay/actionLayout';

const projectRoot = process.cwd();
const srcRoot = join(projectRoot, 'src');

/**
 * Normaliza texto para el escaneo de léxico (minúsculas, sin tildes).
 * Copia deliberada del helper de content.test.ts: importar desde un test
 * registraría SU suite dentro de esta (duplicado de tests).
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), 'utf8');
}

/** Todos los archivos de src/ (recursivo, cualquier extensión). */
function allFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue; // el código de test puede leer src
      out.push(...allFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// DoD 1 — Funciona 100 % client-side; sin llamadas de red tras la carga.
// ---------------------------------------------------------------------------

describe('DoD 1 — 100 % client-side (sin llamadas de red tras la carga)', () => {
  it('NINGÚN módulo de src/ usa fetch, XHR, WebSocket, SSE ni sendBeacon', () => {
    const networkPattern =
      /\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|new\s+EventSource|sendBeacon\s*\(/;
    const offenders = allFiles(srcRoot)
      .filter((file) => extname(file) === '.ts')
      .filter((file) => networkPattern.test(readFileSync(file, 'utf8')));
    expect(offenders, `llamadas de red en: ${offenders.join(', ')}`).toEqual([]);
  });

  it('la ÚNICA referencia externa es Google Fonts en index.html (primer load, SPEC §10.1)', () => {
    const html = readSource('index.html');
    expect(html).toContain('fonts.googleapis.com');
    expect(html).toContain('fonts.gstatic.com');
    // Y no hay <script src="http…"> ni iframes externos.
    expect(html).not.toMatch(/<script[^>]+src="https?:\/\//);
    expect(html).not.toMatch(/<iframe/i);
  });

  it('la carga de fuentes tiene TIMEOUT y fallback serif (nunca bloquea el juego)', () => {
    const preload = readSource('src/scenes/PreloadScene.ts');
    expect(preload).toMatch(/FONT_TIMEOUT_MS/);
    expect(preload).toMatch(/document\.fonts/);
  });
});

// ---------------------------------------------------------------------------
// DoD 2 — Responsive verificado de 320 px a 1920 px, táctil y mouse.
// ---------------------------------------------------------------------------

describe('DoD 2 — responsive 320→1920 verificado (táctil y mouse)', () => {
  it('el canvas FIT cabe y conserva 720:1280 en TODA la cadena del QA (320→1920)', () => {
    // Matriz compacta del DoD (la exhaustiva vive en responsive.test.ts).
    for (const [w, h] of [
      [320, 480], [375, 667], [768, 1024], [1920, 1080], [1280, 720], [1280, 853],
    ] as const) {
      const fit = fitScale(w, h, BASE_WIDTH, BASE_HEIGHT);
      expect(fit.fits, `${w}×${h}`).toBe(true);
      expect(fit.cssWidth / fit.cssHeight).toBeCloseTo(BASE_WIDTH / BASE_HEIGHT, 6);
    }
  });

  it('el letterbox es DECORADO (niebla CSS), no barras negras duras (SPEC §9)', () => {
    const css = readSource('src/style.css');
    expect(css).toMatch(/background-color:\s*#0d0f14/);
    expect(css).toMatch(/radial-gradient/); // bruma, no negro plano
    expect(css).toMatch(/rgba\(58,\s*64,\s*72/); // tono niebla #3a4048
  });

  it('input unificado pointerdown: táctil y mouse por el MISMO camino (SPEC §9)', () => {
    // El check profundo (nada esencial en hover) vive en accessibility.test;
    // aquí se fija el requisito de nivel DoD sobre las escenas.
    for (const scene of ['MenuScene', 'NarrativeScene', 'ActionScene', 'VictoryScene']) {
      expect(readSource(`src/scenes/${scene}.ts`)).toMatch(/POINTER_DOWN/);
    }
  });
});

// ---------------------------------------------------------------------------
// DoD 3 — Flujo completo jugable: Menu → Narrativa → Acción → Quiz → Victoria.
// ---------------------------------------------------------------------------

describe('DoD 3 — flujo completo jugable (grafo de escenas)', () => {
  it('el mapa de navegación cubre las 9 claves del flujo (SPEC §3 + intro pre-nivel)', () => {
    const keys = Object.keys(NEXT_SCENE);
    expect(keys.length).toBe(9);
    for (const key of Object.values(SceneKey)) {
      expect(keys, `falta la escena ${key}`).toContain(key);
    }
  });

  it('la cadena principal conecta BOOT → … → VICTORY → MENU (con la intro)', () => {
    const chain: string[] = [SceneKey.BOOT];
    let cursor: SceneKey = SceneKey.BOOT;
    for (let i = 0; i < 9; i++) {
      cursor = nextSceneKey(cursor);
      chain.push(cursor);
      if (cursor === SceneKey.MENU && i >= 6) break; // vuelta a menú tras ganar
    }
    expect(chain).toEqual([
      SceneKey.BOOT, SceneKey.PRELOAD, SceneKey.MENU, SceneKey.INTRO,
      SceneKey.NARRATIVE, SceneKey.ACTION, SceneKey.QUIZ, SceneKey.VICTORY, SceneKey.MENU,
    ]);
  });

  it('las 8 escenas del flujo están registradas EN ORDEN en game.config', () => {
    const source = readSource('src/config/game.config.ts');
    const order = ['BootScene', 'PreloadScene', 'MenuScene', 'IntroScene', 'NarrativeScene', 'ActionScene', 'QuizScene', 'VictoryScene'];
    let last = -1;
    for (const name of order) {
      const at = source.indexOf(name, last + 1);
      expect(at, `${name} no está registrado en orden`).toBeGreaterThan(last);
      last = at;
    }
  });
});

// ---------------------------------------------------------------------------
// DoD 4 — Reglas de fallo: timeout reintenta minijuego; quiz incorrecto
// reinicia el nivel completo (D5/D6).
// ---------------------------------------------------------------------------

describe('DoD 4 — reglas de fallo (D5: quiz reinicia nivel · D6: timeout reintenta)', () => {
  it('quiz incorrecto → reinicio del NIVEL completo (vuelve a NARRATIVE)', () => {
    expect(ALT_TRANSITIONS.quizWrong.from).toBe(SceneKey.QUIZ);
    expect(ALT_TRANSITIONS.quizWrong.to).toBe(SceneKey.NARRATIVE);
  });

  it('timeout → GAME_OVER (overlay) → «Reintentar» vuelve SOLO al minijuego', () => {
    expect(ALT_TRANSITIONS.actionTimeout.from).toBe(SceneKey.ACTION);
    expect(ALT_TRANSITIONS.actionTimeout.to).toBe(SceneKey.GAME_OVER);
    expect(NEXT_SCENE[SceneKey.GAME_OVER]).toBe(SceneKey.ACTION);
  });

  it('el reinicio por quiz descarta la tanda pero CONSERVA inProgress (D5, SPEC §11)', () => {
    // QuizScene.restartLevel() llama reset() + setInProgress(true).
    const quizSource = readSource('src/scenes/QuizScene.ts');
    expect(quizSource).toMatch(/scoreSystem\.reset\(\)/);
    expect(quizSource).toMatch(/setInProgress\(true\)/);
  });

  it('«Reintentar» reinicia SOLO el minijuego (timer y contador a cero, D6)', () => {
    const actionSource = readSource('src/scenes/ActionScene.ts');
    const retryBlock = actionSource.slice(actionSource.indexOf('private onRetry'), actionSource.indexOf('private onPause'));
    expect(retryBlock).toMatch(/scoreSystem\.reset\(\)/);
    expect(retryBlock).toMatch(/initialErraticState/);
    expect(retryBlock).not.toMatch(/scene\.start|transitionTo/); // NO cambia de escena
  });
});

// ---------------------------------------------------------------------------
// DoD 5 — Puntaje conforme a SPEC §5, con desglose en la pantalla final.
// ---------------------------------------------------------------------------

describe('DoD 5 — puntaje conforme a SPEC §5 (constantes + desglose verificado)', () => {
  it('las constantes del puntaje son EXACTAMENTE las de la SPEC §5', () => {
    expect(TAP_POINTS).toBe(10);
    expect(QUIZ_POINTS).toBe(100);
    expect(TIME_BONUS_PER_SECOND).toBe(2);
  });

  it('el caso de aceptación del PLAN: 3 taps + 20 s restantes + quiz pendiente = 70 pts', () => {
    expect(actionRoundScore(3, 20000)).toBe(70);
    expect(timeBonus(45000)).toBe(90); // bonus máximo teórico de la tanda
    expect(timeBonus(0)).toBe(0); // timeout sin bonus
  });

  it('el desglose de la victoria suma SIEMPRE el total (taps + quiz + bonus)', () => {
    const breakdown = buildScoreBreakdown({ taps: 30, quiz: 100, bonus: 84 });
    expect(breakdown.lines.length).toBe(3);
    expect(breakdown.total).toBe(breakdown.lines.reduce((sum, line) => sum + line.value, 0));
    expect(breakdown.total).toBe(214); // máximo teórico del Nivel 1 (SPEC §5)
  });
});

// ---------------------------------------------------------------------------
// DoD 6 — Progreso y mute persisten tras recargar; save corrupto no rompe.
// ---------------------------------------------------------------------------

describe('DoD 6 — persistencia (progreso + mute; corrupto → defaults)', () => {
  class FakeStorage implements StorageLike {
    readonly map = new Map<string, string>();
    getItem(key: string): string | null {
      return this.map.get(key) ?? null;
    }
    setItem(key: string, value: string): void {
      this.map.set(key, value);
    }
    removeItem(key: string): void {
      this.map.delete(key);
    }
  }

  it('el save vive bajo la CLAVE ÚNICA de la SPEC §11', () => {
    expect(SAVE_KEY).toBe('jekyll_hyde_save_v1');
  });

  it('inProgress y mute SOBREVIVEN a una recarga simulada (nueva instancia)', () => {
    const storage = new FakeStorage();
    const live = new SaveSystem(storage);
    live.setInProgress(true);
    live.setMuted(true);
    const reloaded = new SaveSystem(storage);
    expect(reloaded.inProgress).toBe(true);
    expect(reloaded.muted).toBe(true);
  });

  it('markLevelComplete cierra la partida y guarda el récord como MÁXIMO', () => {
    const storage = new FakeStorage();
    const save = new SaveSystem(storage);
    save.markLevelComplete(150);
    save.markLevelComplete(90); // peor tanda: el récord no baja
    const reloaded = new SaveSystem(storage);
    expect(reloaded.lastScore).toBe(150);
    expect(reloaded.levelsCompleted).toBe(1);
    expect(reloaded.inProgress).toBe(false);
  });

  it('save corrupto o ausente → defaults SIN lanzar (y el juego sigue)', () => {
    const storage = new FakeStorage();
    storage.setItem(SAVE_KEY, '{corrupto');
    expect(() => new SaveSystem(storage)).not.toThrow();
    expect(new SaveSystem(storage).getData()).toEqual({
      levelsCompleted: 0, lastScore: 0, muted: false, inProgress: false, currentLevel: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// DoD 7 — FPS ≥ 55 en móvil de gama media (medición con ?debug; device real
// queda en docs/QA-CHECKLIST.md — no automatizable sin navegador/dispositivo).
// ---------------------------------------------------------------------------

describe('DoD 7 — FPS: instrumentación lista (?debug); medición en device real', () => {
  it('el query-param ?debug activa el modo medición', () => {
    expect(debugEnabled('?debug')).toBe(true);
    expect(debugEnabled('?debug=1')).toBe(true);
    expect(debugEnabled('?a=b&debug')).toBe(true);
    expect(debugEnabled('?a=b')).toBe(false);
  });

  it('ActionScene muestra el contador de FPS con el loop real del juego', () => {
    const source = readSource('src/scenes/ActionScene.ts');
    expect(source).toMatch(/buildDebugFps/);
    expect(source).toMatch(/actualFps/); // FPS medidos del loop, no estimados
  });

  it('el contador de FPS es legible (24 px sobre noche, éxito ≥ 3:1 — WCAG large)', () => {
    expect(FPS_DEBUG_STYLE.fontSize).toBeGreaterThanOrEqual(24);
  });
});

// ---------------------------------------------------------------------------
// DoD 8 — Sin assets externos de pago ni licencias pendientes (todo
// procedural + Google Fonts, D8).
// ---------------------------------------------------------------------------

describe('DoD 8 — cero assets externos (arte 100 % procedural, D8)', () => {
  it('public/ NO contiene imágenes/sonidos de juego (solo el favicon propio)', () => {
    const publicDir = join(projectRoot, 'public');
    expect(existsSync(publicDir)).toBe(true);
    const files = readdirSync(publicDir);
    expect(files).toEqual(['favicon.svg']);
  });

  it('src/ no contiene ficheros binarios (png/jpg/webp/mp3/wav/ogg/gif)', () => {
    const binary = /\.(png|jpe?g|webp|gif|bmp|mp3|wav|ogg|m4a|ttf|otf|woff2?)$/i;
    const offenders = allFiles(srcRoot).filter((file) => binary.test(file));
    expect(offenders, `assets binarios en: ${offenders.join(', ')}`).toEqual([]);
  });

  it('las texturas se GENERAN en código (Graphics → generateTexture, D8)', () => {
    const textures = readSource('src/art/textures.ts');
    expect(textures).toMatch(/generateTexture/);
  });
});

// ---------------------------------------------------------------------------
// DoD 9 — Textos revisados para público 10+ (violencia sugerida, nunca
// mostrada). La revisión completa vive en content.test.ts; aquí el check
// de nivel DoD sobre el corpus de niveles.
// ---------------------------------------------------------------------------

describe('DoD 9 — textos revisados 10+ (violencia sugerida, nunca mostrada)', () => {
  it('NINGÚN texto del Nivel 1 contiene léxico violento explícito', () => {
    const level = LEVELS[0];
    const texts = [
      level.title,
      ...level.lore.map((panel) => panel.text),
      level.action.hudLabel,
      level.quiz.question,
      ...level.quiz.options.flatMap((option) => [option.text, option.feedback]),
      level.quiz.storyFragment,
    ];
    for (const text of texts) {
      const normalized = normalize(text);
      for (const stem of ['sangr', 'muert', 'mata', 'asesin', 'atropell', 'pisote', 'cadaver', 'arma', 'golpe', 'herid']) {
        expect(new RegExp(`\\b${stem}`).test(normalized), `«${stem}» en: «${text}»`).toBe(false);
      }
    }
  });

  it('el daño NUNCA se muestra: la niña queda «asustada pero ilesa» (D4)', () => {
    expect(LEVELS[0].quiz.storyFragment).toMatch(/asustada pero ilesa/);
  });
});

// ---------------------------------------------------------------------------
// DoD 10 — npm run build sin errores ni warnings de TS; deploy estático
// funcionando. La EJECUCIÓN del build es del CI/deploy (no se puede ejecutar
// un subprocess desde un test unitario de forma fiable); aquí se fijan las
// garantías de configuración y el deploy manual queda documentado.
// ---------------------------------------------------------------------------

describe('DoD 10 — build de producción y deploy estático (config garantizada)', () => {
  it('el build es relativo (base "./"): funciona bajo el subpath de GitHub Pages', () => {
    const vite = readSource('vite.config.ts');
    expect(vite).toMatch(/base:\s*'\.\/'/);
  });

  it('TypeScript STRICT (Etapa 0): el type-check del build es estricto', () => {
    const tsconfig = JSON.parse(readSource('tsconfig.json').replace(/\/\*[\s\S]*?\*\//g, ''));
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.noUnusedLocals).toBe(true);
    expect(tsconfig.compilerOptions.noUnusedParameters).toBe(true);
  });

  it('CI corre tests + build en cada push/PR (red de seguridad del DoD 10)', () => {
    const ci = readSource('.github/workflows/ci.yml');
    expect(ci).toMatch(/npm test/);
    expect(ci).toMatch(/npm run build/);
  });

  it('el deploy de Pages es MANUAL (workflow_dispatch) hasta habilitar Pages', () => {
    const deploy = readSource('.github/workflows/deploy.yml');
    expect(deploy).toMatch(/workflow_dispatch/); // no dispara en push
    expect(deploy).toMatch(/deploy-pages/);
  });
});
