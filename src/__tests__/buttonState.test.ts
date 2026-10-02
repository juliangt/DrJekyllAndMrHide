/**
 * Etapa 2 — test de la máquina de estados pura del GothicButton
 * (`src/ui/buttonState.ts`) y de su LAYOUT como datos. Sin Phaser: todo
 * lo testeable del botón vive en ese módulo (transiciones, alturas ≥ 64,
 * colores por estado desde la paleta — SPEC §6/§9/§7.1).
 */
import { describe, expect, it } from 'vitest';
import {
  ButtonPointerEvent,
  ButtonVisualState,
  MENU_BUTTON_LAYOUT,
  MIN_TOUCH_HEIGHT,
  nextButtonState,
  type ButtonLayout,
} from '../ui/buttonState';
import { PALETTE, type HexColor } from '../config/palette';

const { Idle, Hover, Pressed } = ButtonVisualState;
const { PointerOver, PointerOut, PointerDown, PointerUp, PointerUpOutside } = ButtonPointerEvent;
const ALL_EVENTS = [PointerOver, PointerOut, PointerDown, PointerUp, PointerUpOutside] as const;
const ALL_STATES = [Idle, Hover, Pressed] as const;

describe('nextButtonState — transiciones hover/pressed/out/up', () => {
  it('idle --over--> hover', () => {
    expect(nextButtonState(Idle, PointerOver)).toBe(Hover);
  });

  it('idle --down--> pressed (táctil directo, sin hover previo)', () => {
    expect(nextButtonState(Idle, PointerDown)).toBe(Pressed);
  });

  it('hover --out--> idle', () => {
    expect(nextButtonState(Hover, PointerOut)).toBe(Idle);
  });

  it('hover --down--> pressed (mouse desktop)', () => {
    expect(nextButtonState(Hover, PointerDown)).toBe(Pressed);
  });

  it('pressed --up--> hover (tras soltar, el mouse sigue encima)', () => {
    expect(nextButtonState(Pressed, PointerUp)).toBe(Hover);
  });

  it('pressed --out--> idle (dedo que se va tras el tap)', () => {
    expect(nextButtonState(Pressed, PointerOut)).toBe(Idle);
  });

  it('pressed --upoutside--> idle (soltó fuera: cancela)', () => {
    expect(nextButtonState(Pressed, PointerUpOutside)).toBe(Idle);
  });

  it('idle --up--> idle y hover --up--> hover (up sin down no hace nada)', () => {
    expect(nextButtonState(Idle, PointerUp)).toBe(Idle);
    expect(nextButtonState(Hover, PointerUp)).toBe(Hover);
  });

  it('eventos irrelevantes no cambian el estado', () => {
    expect(nextButtonState(Idle, PointerOut)).toBe(Idle);
    expect(nextButtonState(Idle, PointerUpOutside)).toBe(Idle);
    expect(nextButtonState(Hover, PointerOver)).toBe(Hover);
    expect(nextButtonState(Pressed, PointerOver)).toBe(Pressed);
    expect(nextButtonState(Pressed, PointerDown)).toBe(Pressed);
  });
});

describe('nextButtonState — disabled ignora TODO input', () => {
  it.each(ALL_STATES)('%s con disabled: cualquier evento deja en idle', (state) => {
    for (const event of ALL_EVENTS) {
      expect(nextButtonState(state, event, true), `${state} + ${event}`).toBe(Idle);
    }
  });
});

describe('nextButtonState — nunca devuelve estados inválidos', () => {
  it('para cada estado y evento (habilitado y disabled) el resultado es un estado conocido', () => {
    const valid = new Set<string>(ALL_STATES);
    for (const state of ALL_STATES) {
      for (const event of ALL_EVENTS) {
        expect(valid.has(nextButtonState(state, event, false))).toBe(true);
        expect(valid.has(nextButtonState(state, event, true))).toBe(true);
      }
    }
  });

  it('es determinista: misma entrada, misma salida', () => {
    for (const state of ALL_STATES) {
      for (const event of ALL_EVENTS) {
        expect(nextButtonState(state, event)).toBe(nextButtonState(state, event));
      }
    }
  });
});

describe('MENU_BUTTON_LAYOUT — layout como datos (SPEC §9)', () => {
  it('el alto del botón (y de su hitbox) es ≥ 64 px', () => {
    expect(MENU_BUTTON_LAYOUT.height).toBeGreaterThanOrEqual(MIN_TOUCH_HEIGHT);
    expect(MIN_TOUCH_HEIGHT).toBe(64);
  });

  it('dimensiones y paddings positivos y coherentes', () => {
    expect(MENU_BUTTON_LAYOUT.minWidth).toBeGreaterThan(0);
    expect(MENU_BUTTON_LAYOUT.paddingX).toBeGreaterThan(0);
    expect(MENU_BUTTON_LAYOUT.cornerRadius).toBeGreaterThan(0);
    expect(MENU_BUTTON_LAYOUT.fontSize).toBeGreaterThan(0);
    expect(MENU_BUTTON_LAYOUT.fontFamily.length).toBeGreaterThan(0);
  });

  it('define colores para los TRES estados (hover desktop · pressed táctil)', () => {
    expect(Object.keys(MENU_BUTTON_LAYOUT.states).sort()).toEqual(
      [Idle, Hover, Pressed].sort(),
    );
  });

  it('todos los colores por estado son de la paleta (SPEC §7.1)', () => {
    const paletteValues = new Set<string>(Object.values(PALETTE));
    const check = (color: HexColor, where: string): void => {
      expect(
        paletteValues.has(color),
        `${where}: ${color} no está en la paleta`,
      ).toBe(true);
    };
    for (const [state, colors] of Object.entries(MENU_BUTTON_LAYOUT.states)) {
      check(colors.fill, `states.${state}.fill`);
      check(colors.stroke, `states.${state}.stroke`);
      check(colors.text, `states.${state}.text`);
    }
  });

  it('los estados se DISTINGUEN por el relleno (feedback visual claro)', () => {
    const { states } = MENU_BUTTON_LAYOUT;
    expect(states[Hover].fill).not.toBe(states[Idle].fill);
    expect(states[Pressed].fill).not.toBe(states[Idle].fill);
    expect(states[Pressed].fill).not.toBe(states[Hover].fill);
  });

  it('el layout es compatible con la interfaz ButtonLayout (estructura completa)', () => {
    const layout: ButtonLayout = MENU_BUTTON_LAYOUT;
    expect(layout.states[Idle]).toHaveProperty('fill');
    expect(layout.states[Idle]).toHaveProperty('stroke');
    expect(layout.states[Idle]).toHaveProperty('text');
  });
});
