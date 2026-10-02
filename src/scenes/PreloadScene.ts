/**
 * PRELOAD (SPEC §3, §7.3): espera a que las tipografías web (Google Fonts
 * enlazadas en index.html) estén listas vía `document.fonts.ready`, con
 * TIMEOUT de seguridad (3 s) tras el cual se sigue con el fallback serif
 * (Georgia) — nunca se bloquea el juego por fuentes lentas (SPEC §13).
 * Mientras tanto muestra una pantalla mínima y después pasa a MENU con la
 * transición fade (`sceneNav.transitionTo`).
 */
import Phaser from 'phaser';
import { SceneKey } from '../config/sceneKeys';
import { textPrimary } from '../config/palette';
import { fadeIn, transitionTo } from './sceneNav';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';

/** Tolerancia máxima de espera de fuentes (ms) antes del fallback serif. */
const FONT_TIMEOUT_MS = 3000;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.PRELOAD);
  }

  create(): void {
    fadeIn(this);

    // Pantalla mínima en serif del sistema (las web fonts aún pueden no
    // estar; este texto NO depende de ellas).
    this.add
      .text(BASE_WIDTH / 2, BASE_HEIGHT / 2, 'La niebla se levanta…', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '32px',
        color: textPrimary,
      })
      .setOrigin(0.5);

    void this.waitForFonts().then(() => {
      transitionTo(this, SceneKey.MENU);
    });
  }

  /** `document.fonts.ready` con timeout; resuelve pase lo que pase. */
  private async waitForFonts(): Promise<void> {
    const timeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, FONT_TIMEOUT_MS);
    });
    try {
      const fontsReady =
        typeof document !== 'undefined' && document.fonts
          ? document.fonts.ready.then(() => undefined)
          : Promise.resolve();
      await Promise.race([fontsReady, timeout]);
    } catch {
      // Sin FontFaceSet disponible: continuar con el fallback serif.
    }
  }
}
