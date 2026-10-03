/**
 * Etapa 6 — test del campo de firma del diploma (`ui/nameField.ts`): el
 * módulo es PURO DOM (sin Phaser) así que se ejercita directo en jsdom.
 *
 *  - `canvasPointToCss`: matemática de `Scale.FIT + CENTER_BOTH` — escala
 *    mínima de razones + centrado con letterbox — de coords de juego
 *    (720×1280) a px CSS de viewport.
 *  - `NameField`: creación del <input> con estilo de época, posicionado
 *    sobre la zona de firma (y recolocado en resize), maxlength/placeholder,
 *    eventos input/commit (Enter → blur → commit) y `destroy()` que QUITA
 *    el elemento del DOM (al cambiar de escena el input debe desaparecer).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  NameField,
  canvasPointToCss,
  type CanvasRectLike,
  type NameFieldOptions,
} from '../ui/nameField';

// ---- canvasPointToCss -----------------------------------------------------------

describe('canvasPointToCss — lienzo lógico → px CSS (Scale.FIT + CENTER_BOTH)', () => {
  it('escala uniforme y sin letterbox: punto exactamente proporcional', () => {
    // Canvas CSS de 360×640: la mitad exacta del lienzo 720×1280.
    const rect: CanvasRectLike = { left: 100, top: 50, width: 360, height: 640 };
    const placement = canvasPointToCss({ x: 360, y: 420 }, rect, 720, 1280);
    expect(placement.scale).toBe(0.5);
    expect(placement.left).toBe(100 + 360 * 0.5); // 280
    expect(placement.top).toBe(50 + 420 * 0.5); // 260
  });

  it('añade el offset del rect (posición del canvas en el viewport)', () => {
    const rect: CanvasRectLike = { left: 40, top: 10, width: 720, height: 1280 };
    const placement = canvasPointToCss({ x: 0, y: 0 }, rect, 720, 1280);
    expect(placement.left).toBe(40);
    expect(placement.top).toBe(10);
    expect(placement.scale).toBe(1);
  });

  it('con rect no proporcional centra con letterbox (replica FIT+CENTER_BOTH)', () => {
    // Rect ancho: la escala la manda el ALTO (1280*k ≤ 640 → k = 0.5), y el
    // sobrante horizontal (720*0.5=360 vs 800 de ancho) se reparte 220 a cada lado.
    const rect: CanvasRectLike = { left: 0, top: 0, width: 800, height: 640 };
    const placement = canvasPointToCss({ x: 0, y: 0 }, rect, 720, 1280);
    expect(placement.scale).toBe(0.5);
    expect(placement.left).toBe(220);
    expect(placement.top).toBe(0);
    // El centro del lienzo cae en el centro del rect.
    const center = canvasPointToCss({ x: 360, y: 640 }, rect, 720, 1280);
    expect(center.left).toBe(400);
    expect(center.top).toBe(320);
  });

  it('entradas degeneradas (rect 0, bases 0) no producen NaN', () => {
    const zero = canvasPointToCss({ x: 10, y: 10 }, { left: 0, top: 0, width: 0, height: 0 }, 720, 1280);
    expect(Number.isNaN(zero.left)).toBe(false);
    expect(Number.isNaN(zero.top)).toBe(false);
    expect(zero.scale).toBe(0);

    const noBase = canvasPointToCss(
      { x: 10, y: 10 },
      { left: 0, top: 0, width: 100, height: 100 },
      0,
      0,
    );
    expect(noBase.scale).toBe(0);
    expect(Number.isNaN(noBase.left)).toBe(false);
  });
});

// ---- NameField --------------------------------------------------------------------

/** Opciones de fábrica: centro de la línea del nombre del diploma (juego). */
function makeOptions(
  overrides: Partial<NameFieldOptions> = {},
): NameFieldOptions {
  return {
    getCanvasRect: () => ({ left: 0, top: 0, width: 720, height: 1280 }),
    baseWidth: 720,
    baseHeight: 1280,
    center: { x: 360, y: 406 },
    width: 320,
    height: 46,
    fontFamily: '"Special Elite", Georgia, serif',
    fontSize: 28,
    color: '#2b2620',
    backgroundColor: '#d8c9a3',
    placeholder: 'Tu nombre',
    maxLength: 20,
    onInput: vi.fn(),
    onCommit: vi.fn(),
    ...overrides,
  };
}

describe('NameField — input DOM de la firma (Etapa 6)', () => {
  it('crea el <input>, lo cuelga del body y nace OCULTO', () => {
    const field = new NameField(document, makeOptions());
    expect(field.element).toBeInstanceOf(HTMLInputElement);
    expect(field.element.type).toBe('text');
    expect(document.body.contains(field.element)).toBe(true);
    expect(field.element.style.display).toBe('none');
    expect(field.isVisible).toBe(false);
    field.destroy();
  });

  it('posiciona el campo sobre la zona de firma usando el rect del canvas', () => {
    const getCanvasRect = () => ({ left: 100, top: 50, width: 360, height: 640 });
    const field = new NameField(document, makeOptions({ getCanvasRect }));
    // (360, 406) a escala 0.5 con rect (100, 50): left=280, top=253.
    expect(field.element.style.left).toBe('280px');
    expect(field.element.style.top).toBe('253px');
    expect(field.element.style.width).toBe('160px'); // 320 * 0.5
    expect(field.element.style.fontSize).toBe('14px'); // 28 * 0.5
    field.destroy();
  });

  it('aplica estilo de época: tinta sobre pergamino OPACO (cubre la línea al editar)', () => {
    const field = new NameField(document, makeOptions());
    expect(field.element.style.color).toBe('rgb(43, 38, 32)'); // #2b2620
    expect(field.element.style.backgroundColor).toBe('rgb(216, 201, 163)'); // #d8c9a3
    expect(field.element.style.position).toBe('fixed');
    expect(field.element.style.textAlign).toBe('center');
    field.destroy();
  });

  it('respeta maxlength y placeholder (nombre opcional, máx 20)', () => {
    const field = new NameField(document, makeOptions());
    expect(field.element.getAttribute('maxlength')).toBe('20');
    expect(field.element.placeholder).toBe('Tu nombre');
    field.destroy();
  });

  it('show() muestra y da focus; hide() oculta; el valor sobrevive', () => {
    const field = new NameField(document, makeOptions());
    field.setValue('Ana');
    field.show();
    expect(field.isVisible).toBe(true);
    expect(document.activeElement).toBe(field.element);
    field.hide();
    expect(field.isVisible).toBe(false);
    expect(field.getValue()).toBe('Ana');
    field.destroy();
  });

  it('dispara onInput mientras se escribe', () => {
    const onInput = vi.fn();
    const field = new NameField(document, makeOptions({ onInput }));
    field.element.value = 'Ana';
    field.element.dispatchEvent(new Event('input'));
    expect(onInput).toHaveBeenCalledWith('Ana');
    field.destroy();
  });

  it('blur confirma con onCommit (tocar fuera / Enter → blur)', () => {
    const onCommit = vi.fn();
    const field = new NameField(document, makeOptions({ onCommit }));
    field.element.value = 'Ana';
    field.element.dispatchEvent(new Event('blur'));
    expect(onCommit).toHaveBeenCalledWith('Ana');
    field.destroy();
  });

  it('Enter NO dispara submit propio: hace blur y el commit llega una sola vez', () => {
    const onCommit = vi.fn();
    const field = new NameField(document, makeOptions({ onCommit }));
    field.element.focus();
    field.element.value = 'Ana';
    const prevented = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    field.element.dispatchEvent(prevented);
    expect(prevented.defaultPrevented).toBe(true); // preventDefault (sin submit)
    // El blur dispara el commit UNA sola vez (única vía de confirmación).
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(field.element);
    field.destroy();
  });

  it('recoloca en el resize de la ventana (Scale.FIT reescala el canvas)', () => {
    let rect: CanvasRectLike = { left: 0, top: 0, width: 720, height: 1280 };
    const field = new NameField(document, makeOptions({ getCanvasRect: () => rect }));
    expect(field.element.style.left).toBe('360px'); // centro x=360 a escala 1
    rect = { left: 0, top: 0, width: 360, height: 640 };
    window.dispatchEvent(new Event('resize'));
    expect(field.element.style.left).toBe('180px'); // 360 * 0.5
    field.destroy();
  });

  it('destroy() QUITA el elemento del DOM y deja de escuchar resize', () => {
    let rect: CanvasRectLike = { left: 0, top: 0, width: 720, height: 1280 };
    const field = new NameField(document, makeOptions({ getCanvasRect: () => rect }));
    field.destroy();
    expect(document.body.contains(field.element)).toBe(false);
    // Tras destroy, un resize ya NO recoloca (listener baja).
    const before = field.element.style.left;
    rect = { left: 0, top: 0, width: 100, height: 200 };
    window.dispatchEvent(new Event('resize'));
    expect(field.element.style.left).toBe(before);
    // Idempotente.
    expect(() => field.destroy()).not.toThrow();
  });
});
