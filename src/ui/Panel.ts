/**
 * Panel (SPEC §6/§7.2, PLAN Etapa 3): marco tipo pergamino OSCURO
 * (rectángulo redondeado + borde doble sepia) reutilizable por narrativa,
 * quiz y paneles de historia.
 *
 * Arquitectura de la etapa: el ESTILO y el LAYOUT viven como datos puros en
 * `config/narrative.ts` (`NARRATIVE_PANEL_STYLE` / `NARRATIVE_PANEL_LAYOUT`)
 * y el wrap del texto lo calcula `panelTextLayout` SIN Phaser (testeado).
 * Esta clase es la capa Phaser fina: dibuja el marco con Graphics y pinta
 * las líneas pre-calculadas, fusionando palabras contiguas del mismo estilo
 * (normal / énfasis **negrita**) en un `Text` por tramo.
 */
import Phaser from 'phaser';
import { hexToNumber } from '../config/palette';
import {
  panelTextWidth,
  type NarrativePanelLayout,
  type WrappedLine,
} from '../config/narrative';

/** Estilo del marco (datos puros en `config/narrative.ts`). */
export interface PanelStyle {
  /** Relleno del pergamino. */
  fill: `#${string}`;
  /** Color del borde doble. */
  stroke: `#${string}`;
  cornerRadius: number;
  borderWidth: number;
}

/** Estilo de los runs de texto (datos puros en `config/narrative.ts`). */
export interface PanelTextStyle {
  fontFamily: string;
  color: string;
  emphasisColor: string;
}

/** Config de construcción (todo menos x/y, que van en el constructor). */
export interface PanelOptions {
  width: number;
  height: number;
  style: PanelStyle;
}

/** Un tramo contiguo de palabras con el mismo estilo (normal o énfasis). */
interface TextRun {
  text: string;
  bold: boolean;
}

export class Panel extends Phaser.GameObjects.Container {
  private readonly options: PanelOptions;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly content: Phaser.GameObjects.Container;
  private lineTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, options: PanelOptions) {
    super(scene, x, y);
    this.options = options;
    this.frame = scene.add.graphics();
    this.content = scene.add.container(0, 0);
    this.add([this.frame, this.content]);
    this.drawFrame();
    scene.add.existing(this);
  }

  /** Contenedor del contenido (para crossfades sin tocar el marco). */
  get contentContainer(): Phaser.GameObjects.Container {
    return this.content;
  }

  /**
   * Reemplaza el contenido por las líneas pre-wrappeadas de `panelTextLayout`
   * (la garantía de «nunca desborda» la da esa función pura, no Phaser).
   */
  setWrappedLines(
    lines: readonly WrappedLine[],
    layout: NarrativePanelLayout,
    style: PanelTextStyle,
  ): void {
    this.clearContent();
    const areaWidth = panelTextWidth(layout);
    const blockHeight = lines.length * layout.lineHeightPx;
    let lineY = -blockHeight / 2 + layout.lineHeightPx / 2;

    for (const line of lines) {
      const runs = mergeRuns(line);
      let x = -areaWidth / 2; // alineado a la izquierda del área de texto
      runs.forEach((run, runIndex) => {
        // Espacio final explícito entre tramos: el cursor avanza con el
        // ancho REAL medido del texto (métrica de la fuente cargada).
        const isLastRun = runIndex === runs.length - 1;
        const label = isLastRun ? run.text : `${run.text} `;
        const text = this.scene.add
          .text(x, lineY, label, {
            fontFamily: style.fontFamily,
            fontSize: `${layout.fontSize}px`,
            color: run.bold ? style.emphasisColor : style.color,
            ...(run.bold ? { fontStyle: 'bold' } : {}),
          })
          .setOrigin(0, 0.5);
        this.lineTexts.push(text);
        this.content.add(text);
        x += text.width;
      });
      lineY += layout.lineHeightPx;
    }
  }

  /** Retira el contenido actual (el marco queda intacto). */
  clearContent(): void {
    for (const text of this.lineTexts) {
      text.destroy();
    }
    this.lineTexts = [];
  }

  /** Marco pergamino: relleno + borde doble sepia (SPEC §7.2). */
  private drawFrame(): void {
    const { width, height, style } = this.options;
    const left = -width / 2;
    const top = -height / 2;
    const g = this.frame;
    g.fillStyle(hexToNumber(style.fill), 1);
    g.fillRoundedRect(left, top, width, height, style.cornerRadius);
    g.lineStyle(style.borderWidth, hexToNumber(style.stroke), 1);
    g.strokeRoundedRect(left, top, width, height, style.cornerRadius);
    const inset = style.borderWidth * 2;
    g.lineStyle(Math.max(2, Math.round(style.borderWidth / 3)), hexToNumber(style.stroke), 0.6);
    g.strokeRoundedRect(
      left + inset,
      top + inset,
      width - 2 * inset,
      height - 2 * inset,
      Math.max(4, style.cornerRadius - inset),
    );
  }
}

/** Fusiona palabras contiguas del mismo estilo en tramos renderizables. */
function mergeRuns(line: WrappedLine): TextRun[] {
  const runs: TextRun[] = [];
  for (const word of line.words) {
    const last = runs[runs.length - 1];
    if (last && last.bold === word.bold) {
      last.text = `${last.text} ${word.text}`;
    } else {
      runs.push({ text: word.text, bold: word.bold });
    }
  }
  return runs;
}
