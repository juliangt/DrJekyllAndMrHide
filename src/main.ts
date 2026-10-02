/**
 * Bootstrap del juego (SPEC §10.2): crea el `Phaser.Game` con la config real
 * de `src/config/game.config.ts` (base 720×1280, `Scale.FIT` +
 * `CENTER_BOTH`, fondo de noche y las 7 escenas del flujo registradas).
 * Todo el detalle de configuración vive en ese módulo; aquí no hay config
 * inline.
 */
import Phaser from 'phaser';
import { gameConfig } from './config/game.config';
import './style.css';

new Phaser.Game(gameConfig);
