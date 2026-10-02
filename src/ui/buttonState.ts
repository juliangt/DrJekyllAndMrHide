/**
 * Máquina de estados + layout del GothicButton como LÓGICA PURA y DATOS
 * (arquitectura de la Etapa 2): `GothicButton.ts` importa Phaser en runtime,
 * así que TODO lo testeable vive aquí — transiciones de estados visuales,
 * dimensiones (≥ 64 px, SPEC §9) y colores por estado (desde la paleta).
 *
 * Los eventos usan los literales de `Phaser.Input.Events` ('pointerover',
 * 'pointerout', 'pointerdown', 'pointerup', 'pointerupoutside'), escritos
 * como strings para que este módulo no dependa de Phaser.
 */

import type { HexColor } from '../config/palette';
import {
  labGreen,
  parchmentDark,
  parchmentLight,
  potionPurple,
  textPrimary,
} from '../config/palette';

// ---- Estados y eventos (const-object + unión: NO enum, erasableSyntaxOnly) --

/** Estados visuales del botón (SPEC §6/§7.2: hover desktop · pressed táctil). */
export const ButtonVisualState = {
  Idle: 'idle',
  Hover: 'hover',
  Pressed: 'pressed',
} as const;

export type ButtonVisualState = (typeof ButtonVisualState)[keyof typeof ButtonVisualState];

/** Eventos de puntero que alimentan la máquina (literales de Phaser). */
export const ButtonPointerEvent = {
  PointerOver: 'pointerover',
  PointerOut: 'pointerout',
  PointerDown: 'pointerdown',
  PointerUp: 'pointerup',
  /** Puntero soltado FUERA del botón tras un pointerdown dentro (cancela). */
  PointerUpOutside: 'pointerupoutside',
} as const;

export type ButtonPointerEvent = (typeof ButtonPointerEvent)[keyof typeof ButtonPointerEvent];

/**
 * Transición pura de la máquina de estados del botón.
 *
 *  - `disabled` IGNORA todo input: siempre devuelve `idle` (SPEC §6/§9).
 *  - `idle --over--> hover --down--> pressed --up--> hover` (en táctil, tras
 *    el `up` llega un `out` que vuelve a `idle`).
 *  - `upoutside` y `out` desde `pressed` cancelan SIN activar (la decisión
 *    de disparar `onPress` la toma GothicButton, no la máquina).
 *
 * Nunca devuelve un estado fuera de la unión `ButtonVisualState`.
 */
export function nextButtonState(
  state: ButtonVisualState,
  event: ButtonPointerEvent,
  disabled = false,
): ButtonVisualState {
  if (disabled) {
    return ButtonVisualState.Idle;
  }
  switch (state) {
    case ButtonVisualState.Idle:
      if (event === ButtonPointerEvent.PointerOver) return ButtonVisualState.Hover;
      if (event === ButtonPointerEvent.PointerDown) return ButtonVisualState.Pressed;
      return ButtonVisualState.Idle;
    case ButtonVisualState.Hover:
      if (event === ButtonPointerEvent.PointerOut) return ButtonVisualState.Idle;
      if (event === ButtonPointerEvent.PointerDown) return ButtonVisualState.Pressed;
      return ButtonVisualState.Hover;
    case ButtonVisualState.Pressed:
      if (event === ButtonPointerEvent.PointerUp) return ButtonVisualState.Hover;
      if (
        event === ButtonPointerEvent.PointerOut ||
        event === ButtonPointerEvent.PointerUpOutside
      ) {
        return ButtonVisualState.Idle;
      }
      return ButtonVisualState.Pressed;
  }
}

// ---- Layout como datos ------------------------------------------------------

/** Altura mínima de un botón primario (SPEC §9: ≥ 64 px táctil). */
export const MIN_TOUCH_HEIGHT = 64;

/** Colores de un estado (todos desde `config/palette.ts`, SPEC §7.1). */
export interface ButtonStateColors {
  /** Relleno del marco pergamino. */
  fill: HexColor;
  /** Borde doble sepia. */
  stroke: HexColor;
  /** Color del texto. */
  text: HexColor;
}

/** Dimensiones y colores del botón (datos testeables, no Phaser). */
export interface ButtonLayout {
  /** Ancho mínimo del botón (px). */
  minWidth: number;
  /** Alto del botón y de su hitbox (px) — ≥ `MIN_TOUCH_HEIGHT`. */
  height: number;
  /** Radio de las esquinas del marco. */
  cornerRadius: number;
  /** Padding horizontal interno. */
  paddingX: number;
  /** Tamaño de la fuente del label. */
  fontSize: number;
  /** Pila de fuentes CSS (la primaria se carga en PRELOAD, SPEC §7.3). */
  fontFamily: string;
  /** Colores por estado visual. */
  states: Readonly<Record<ButtonVisualState, ButtonStateColors>>;
}

/**
 * Layout de los botones primarios del menú: alto 96 px (≥ 64, SPEC §9),
 * marco pergamino oscuro con borde doble sepia (SPEC §7.2) y acento verde
 * laboratorio en hover / púrpura poción en pressed — todos de la paleta.
 */
export const MENU_BUTTON_LAYOUT: ButtonLayout = {
  minWidth: 460,
  height: 96,
  cornerRadius: 18,
  paddingX: 36,
  fontSize: 36,
  fontFamily: '"Special Elite", Georgia, serif',
  states: {
    [ButtonVisualState.Idle]: {
      fill: parchmentDark,
      stroke: parchmentLight,
      text: textPrimary,
    },
    [ButtonVisualState.Hover]: {
      fill: labGreen,
      stroke: parchmentLight,
      text: textPrimary,
    },
    [ButtonVisualState.Pressed]: {
      fill: potionPurple,
      stroke: parchmentLight,
      text: textPrimary,
    },
  },
};
