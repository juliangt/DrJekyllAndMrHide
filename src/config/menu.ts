/**
 * DATOS de la pantalla de menú (SPEC §6 / PLAN Etapa 2), estilo data-first:
 * textos, qué botones mostrar según el save (`menuButtonsFor`), la acción
 * «Comenzar» que marca `inProgress` (SPEC §11) y los pasos de «Cómo jugar».
 *
 * Todo es puro y sin Phaser para que los tests lo validen directamente.
 */

import { SceneKey, type SceneKey as SceneKeyType } from './sceneKeys';
import { TEXTURE_KEYS } from '../art/textures';

/** Título placeholder (SPEC §1.1: pendiente de decisión, usa «[TBD]»). */
export const MENU_TITLE = 'Jekyll & Hyde [TBD]';

/** Subtítulo literal del SPEC §6. */
export const MENU_SUBTITLE = 'Una aventura por el libro de R. L. Stevenson';

// ---- Botones del menú --------------------------------------------------------

/** Identificadores de los botones del menú (const-object, NO enum). */
export const MenuButtonId = {
  Start: 'start',
  HowToPlay: 'how-to-play',
  Continue: 'continue',
} as const;

export type MenuButtonId = (typeof MenuButtonId)[keyof typeof MenuButtonId];

/** Un botón a mostrar en el menú (descriptor, no GameObject). */
export interface MenuButtonDescriptor {
  id: MenuButtonId;
  /** Etiqueta visible en español. */
  label: string;
  /**
   * Escena destino al pulsarlo; ausente = acción local sin navegación
   * («Cómo jugar» abre el overlay dentro de MenuScene).
   */
  target?: SceneKeyType;
}

/**
 * Qué botones mostrar (SPEC §6): «Comenzar el viaje» y «Cómo jugar»
 * siempre; «Continuar» SOLO si `save.inProgress === true` (SPEC §11).
 * Destinos (Fase 4 del multi-nivel): «Comenzar» navega a INTRO — la
 * cinemática (Jekyll → Hyde) SOLO se ve al empezar una partida nueva y
 * desemboca en la narrativa del N1; «Continuar» va DIRECTO a NARRATIVE
 * (sin intro) y MenuScene le pasa `{ levelId: save.currentLevel }`, el
 * checkpoint guardado (el `target` es el dato; el payload lo arma la escena).
 */
export function menuButtonsFor(save: { inProgress: boolean }): readonly MenuButtonDescriptor[] {
  const buttons: MenuButtonDescriptor[] = [
    {
      id: MenuButtonId.Start,
      label: 'Comenzar el viaje',
      target: SceneKey.INTRO,
    },
    {
      id: MenuButtonId.HowToPlay,
      label: 'Cómo jugar',
    },
  ];
  if (save.inProgress) {
    // Reanudar = narrativa del nivel guardado, SIN reproducir la intro.
    buttons.push({
      id: MenuButtonId.Continue,
      label: 'Continuar',
      target: SceneKey.NARRATIVE,
    });
  }
  return buttons;
}

/** Contrato que «Comenzar» necesita del SaveSystem (lo satisface y los fakes). */
export interface ProgressStore {
  setInProgress(inProgress: boolean): void;
  /** Checkpoint de nivel (Fase 4): una partida nueva SIEMPRE arranca en el 1. */
  setCurrentLevel(levelId: number): void;
}

/**
 * Acción de «Comenzar el viaje»: marca la partida como en curso para que
 * «Continuar» aparezca en próximas visitas (SPEC §11: se guarda al
 * comenzar nivel) y REINICIA el checkpoint al nivel 1 — es una partida
 * NUEVA: descarta el nivel guardado de una tanda anterior (el récord vive
 * aparte, en `lastScore`, y se conserva). `MenuScene` la invoca antes de
 * transicionar a INTRO.
 */
export function beginJourney(store: ProgressStore): void {
  store.setInProgress(true);
  store.setCurrentLevel(1);
}

// ---- «Cómo jugar» (SPEC §6: leer → tocar → responder) ------------------------

/** Un paso de «Cómo jugar»: icono procedural + textos cortos. */
export interface HowToPlayStep {
  /** Clave de textura del icono (valor de `TEXTURE_KEYS`). */
  iconKey: string;
  /** Titulillo del paso (1 palabra, imperativo). */
  title: string;
  /** Explicación breve (≤ 12 palabras, SPEC §9: textos cortos). */
  text: string;
}

/** Límite de palabras por paso (SPEC §9: textos cortos). */
export const HOW_TO_PLAY_MAX_WORDS = 12;

/** Los 3 pasos ordenados del «Cómo jugar» (SPEC §6). */
export const HOW_TO_PLAY: readonly HowToPlayStep[] = [
  {
    iconKey: TEXTURE_KEYS.iconBook,
    title: 'Lee',
    text: 'Lee cada viñeta de la historia.',
  },
  {
    iconKey: TEXTURE_KEYS.iconTap,
    title: 'Toca',
    text: 'Toca a la niña tres veces a tiempo.',
  },
  {
    iconKey: TEXTURE_KEYS.iconQuestion,
    title: 'Responde',
    text: 'Elige la respuesta correcta sobre el libro.',
  },
];

/** Titular del overlay «Cómo jugar». */
export const HOW_TO_PLAY_TITLE = 'Cómo jugar';

/** Etiqueta del botón que cierra el overlay. */
export const HOW_TO_PLAY_CLOSE_LABEL = 'Cerrar';
