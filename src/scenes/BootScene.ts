/**
 * BOOT (SPEC §3): primer estado del flujo. Genera las texturas procedurales
 * (`generateTextures`, SPEC §7 / D8), crea los sistemas (save / audio /
 * score) y los deja en `this.registry` con las claves 'saveSystem',
 * 'audioSystem' y 'scoreSystem' (el registry de Phaser vive a nivel juego y
 * sobrevive a los cambios de escena). Después pasa a PRELOAD con fade.
 *
 * El AudioContext es LAZY (SPEC §8): se desbloquea con `unlock()` en el
 * primer gesto del usuario — aquí se engancha un listener de un solo uso
 * sobre el canvas del juego (pointerdown/click/touch) y otro sobre keydown
 * de window; ambos persisten aunque esta escena se apague.
 */
import Phaser from 'phaser';
import { generateTextures } from '../art/textures';
import { SceneKey } from '../config/sceneKeys';
import { nightBackground } from '../config/palette';
import { transitionTo } from './sceneNav';
import { AudioSystem } from '../systems/AudioSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { ScoreSystem } from '../systems/ScoreSystem';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.BOOT);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(nightBackground);

    // Arte 100 % procedural (D8) + sistemas compartidos por todo el juego.
    generateTextures(this);
    const saveSystem = new SaveSystem();
    const audioSystem = new AudioSystem({
      saveSystem,
      // Factory real: jsdom no tiene AudioContext, los tests inyectan un fake.
      createContext: (): AudioContext => new AudioContext(),
    });
    const scoreSystem = new ScoreSystem();
    this.registry.set('saveSystem', saveSystem);
    this.registry.set('audioSystem', audioSystem);
    this.registry.set('scoreSystem', scoreSystem);

    // Primer gesto → AudioContext (políticas de autoplay, SPEC §8).
    const unlockAudio = (): void => {
      audioSystem.unlock();
    };
    this.game.canvas.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    transitionTo(this, SceneKey.PRELOAD);
  }
}
