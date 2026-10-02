/**
 * Bootstrap del juego (SPEC §10.2): crea el `Phaser.Game` con resolución base
 * 720×1280, `Scale.FIT` + `CENTER_BOTH` (SPEC §9) y fondo de noche
 * `#0d0f14`, y arranca la única escena de la Etapa 0 (BootScene placeholder,
 * que por ahora solo muestra el color base).
 *
 * A partir de la Etapa 1 la configuración se muda a `src/config/game.config.ts`
 * con el registro de las escenas del flujo.
 */
import Phaser from 'phaser';
import { BASE_WIDTH, BASE_HEIGHT } from './config/dimensions';
import { NIGHT_BACKGROUND } from './config/palette';
import { BootScene } from './scenes/BootScene';
import './style.css';

new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: NIGHT_BACKGROUND,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: BASE_WIDTH,
    height: BASE_HEIGHT,
  },
  scene: [BootScene],
});
