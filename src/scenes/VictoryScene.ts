/**
 * VICTORY (SPEC §3, §6, §11 / PLAN Etapa 6): pantalla final — diploma
 * procedural con felicitación por haber leído la obra, desglose de puntaje
 * (taps + quiz + bonus), récord, input OPCIONAL de nombre y botones de
 * cierre. Capa fina sobre módulos PUROS (arquitectura de la etapa): el
 * desglose lo calcula `buildScoreBreakdown` (gameplay/victory), el rótulo
 * del récord `recordLabel`/`isNewRecord`, el texto del diploma
 * `diplomaText` (nombre en línea fija), el layout/posiciones/colores son
 * DATOS (`VICTORY_LAYOUT`) y la firma DOM la maneja `ui/nameField`
 * (`canvasPointToCss` mapea la zona a px CSS; el input se destruye en
 * SHUTDOWN — al cambiar de escena debe desaparecer).
 *
 * Reglas de la etapa:
 *  - Al entrar lee el score/desglose de la tanda (VICTORY llega con
 *    {levelId} desde QUIZ) y el `lastScore` PREVIO del save ANTES de
 *    marcar (el orden decide si el rótulo es «¡Nuevo récord!»).
 *  - `markLevelComplete(finalScore)` UNA sola vez por entrada (guard
 *    anti-reentrado; el método ya es idempotente: récord = máx):
 *    levelsCompleted = 1, lastScore = récord, inProgress = false → tras
 *    ganar «Continuar» NO reaparece en Menu (menuButtonsFor condicional).
 *  - Diploma: marco pergamino CLARO (mismo `ui/Modal` que la carta del
 *    quiz) + sello de cera púrpura (textura `wax-seal`), felicitación
 *    amable 10+; nombre opcional: si queda vacío el diploma dice
 *    «Valiente lector/a».
 *  - «Jugar de nuevo»: resetea la TANDA (total + desglose por categorías)
 *    y vuelve a NARRATIVE con {levelId} — el récord vive en el save y se
 *    conserva. «Volver al inicio»: transición a MENU.
 *  - Sonido de entrada: arpegio mayor del AudioSystem (SPEC §8, suficiente
 *    como fanfarria corta; no-op si el audio está bloqueado o en mute).
 */
import Phaser from 'phaser';
import { activeLevelFor } from '../config/narrative';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { hexToNumber, nightBackground, street } from '../config/palette';
import { SceneKey } from '../config/sceneKeys';
import { MENU_PARALLAX_LAYERS, STREET_LINE_Y } from '../art/parallax';
import { ParallaxField } from '../art/ParallaxField';
import { getSystems } from '../systems/getSystems';
import type { AudioSystem } from '../systems/AudioSystem';
import type { SaveSystem } from '../systems/SaveSystem';
import type { ScoreSystem } from '../systems/ScoreSystem';
import type { LevelConfig } from '../config/levels/types';
import { fadeIn, transitionTo } from './sceneNav';
import { Modal } from '../ui/Modal';
import { GothicButton } from '../ui/GothicButton';
import { NameField } from '../ui/nameField';
import {
  VICTORY_BUTTON,
  VICTORY_LABELS,
  VICTORY_LAYOUT,
  VICTORY_PANEL_STYLE,
  breakdownPlaqueHeight,
  breakdownRowCenterY,
  buildScoreBreakdown,
  diplomaText,
  isNewRecord,
  recordLabel,
  victoryNameZone,
  type ScoreBreakdownView,
} from '../gameplay/victory';

/** Datos de arranque (`scene.start(VICTORY, data)`), desde QUIZ. */
export interface VictorySceneData {
  levelId?: number;
}

export class VictoryScene extends Phaser.Scene {
  private level!: LevelConfig;
  private systems!: { saveSystem: SaveSystem; audioSystem: AudioSystem; scoreSystem: ScoreSystem };
  private field: ParallaxField | null = null;
  private modal: Modal | null = null;
  /** Cuerpo del diploma (texto Phaser, se refresca al firmar). */
  private diplomaBody: Phaser.GameObjects.Text | null = null;
  /** Input DOM de la firma (null hasta el primer tap en la zona). */
  private nameField: NameField | null = null;
  /** Nombre crudo tecleado (la normalización la hace `sanitizeName`). */
  private rawName = '';
  /** Total de la tanda (fija al entrar; refresca el diploma al firmar). */
  private total = 0;
  /** Guard anti-reentrado del marcado de save (una vez por entrada). */
  private saveMarked = false;
  /** True cuando ya se disparó una salida (anti doble tap). */
  private exiting = false;

  constructor() {
    super(SceneKey.VICTORY);
  }

  init(data: VictorySceneData = {}): void {
    this.level = activeLevelFor(data.levelId);
    this.saveMarked = false;
    this.exiting = false;
    this.field = null;
    this.modal = null;
    this.diplomaBody = null;
    this.nameField = null;
    this.rawName = '';
    this.total = 0;
  }

  create(): void {
    this.systems = getSystems(this);

    // Leer el estado de la tanda ANTES de tocar el save: el récord previo
    // decide el rótulo («¡Nuevo récord!» solo si el total lo SUPERABA).
    const finalScore = this.systems.scoreSystem.getScore();
    const raw = this.systems.scoreSystem.getBreakdown();
    const previousRecord = this.systems.saveSystem.lastScore;

    // Save (SPEC §11) una sola vez por entrada: récord = máx, Completed = 1,
    // inProgress = false (sin «Continuar» en Menu tras ganar).
    this.markCompletionOnce(finalScore);

    fadeIn(this);
    this.cameras.main.setBackgroundColor(nightBackground);

    // Fondo: el callejón del menú, atenuado bajo el velo del diploma.
    this.field = new ParallaxField(this, {
      layers: MENU_PARALLAX_LAYERS,
      ground: { color: street, y: STREET_LINE_Y },
    });

    // Desglose puro (taps + quiz + bonus, total verificado, SPEC §6).
    const breakdown = buildScoreBreakdown({
      taps: raw.taps,
      quiz: raw.quiz,
      bonus: raw.timeBonus,
    });
    this.total = breakdown.total;

    this.buildDiploma(breakdown, finalScore, previousRecord);
    this.buildButtons();

    // Fanfarria de entrada: el arpegio mayor del sistema (SPEC §8).
    this.systems.audioSystem.arpeggio();

    // Limpieza al apagar: el input DOM de la firma DEBE morir con la escena.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.nameField?.destroy();
      this.nameField = null;
      this.modal?.destroy();
      this.modal = null;
    });
  }

  update(time: number): void {
    this.field?.update(time / 1000);
  }

  // ---- Save (una sola vez por entrada) ---------------------------------------

  /** Guard anti-reentrado: marca el nivel completado UNA vez por entrada. */
  private markCompletionOnce(finalScore: number): void {
    if (this.saveMarked) {
      return;
    }
    this.saveMarked = true;
    this.systems.saveSystem.markLevelComplete(finalScore, this.level.id);
  }

  // ---- Diploma ----------------------------------------------------------------

  private buildDiploma(
    breakdown: ScoreBreakdownView,
    finalScore: number,
    previousRecord: number,
  ): void {
    const layout = VICTORY_LAYOUT;

    // Mismo Modal que la carta del quiz: velo + pergamino CLARO + contenido.
    const modal = new Modal(this, {
      centerX: layout.panel.centerX,
      centerY: layout.panel.centerY,
      width: layout.panel.width,
      height: layout.panel.height,
      style: VICTORY_PANEL_STYLE,
      veil: layout.veil,
      depths: {
        veil: layout.depths.veil,
        panel: layout.depths.panel,
        content: layout.depths.content,
      },
    });
    this.modal = modal;
    const content = modal.content;

    // Titular celebratorio (UnifrakturCook, SPEC §7.3).
    content.add(
      this.add
        .text(layout.panel.centerX, layout.heading.centerY, layout.heading.text, {
          fontFamily: layout.heading.fontFamily,
          fontSize: `${layout.heading.fontSize}px`,
          color: layout.heading.color,
        })
        .setOrigin(0.5),
    );

    // Cuerpo: diplomaText(name, total) — el nombre cae SIEMPRE en la línea
    // `nameLineIndex` (estructura fija), así la zona de firma se ancla exacta.
    this.diplomaBody = this.add
      .text(layout.panel.centerX, layout.body.topY, diplomaText(this.rawName, breakdown.total), {
        fontFamily: layout.body.fontFamily,
        fontSize: `${layout.body.fontSize}px`,
        color: layout.body.color,
        align: 'center',
        lineSpacing: layout.body.lineHeightPx - layout.body.fontSize,
        wordWrap: {
          width: layout.panel.width - 2 * layout.panel.padding,
          useAdvancedWrap: false,
        },
      })
      .setOrigin(0.5, 0);
    content.add(this.diplomaBody);

    this.buildNameZone();
    this.buildBreakdown(breakdown, finalScore, previousRecord);

    // Sello de cera púrpura (textura procedural de la etapa), ligeramente
    // girado como cera estampada.
    content.add(
      this.add
        .image(layout.seal.centerX, layout.seal.centerY, layout.seal.textureKey)
        .setDisplaySize(layout.seal.size, layout.seal.size)
        .setRotation(layout.seal.rotationRad)
        .setDepth(layout.depths.seal),
    );

    // Pista de firma al pie del diploma (tenue).
    content.add(
      this.add
        .text(layout.panel.centerX, layout.hint.centerY, layout.hint.text, {
          fontFamily: layout.hint.fontFamily,
          fontSize: `${layout.hint.fontSize}px`,
          color: layout.hint.color,
        })
        .setOrigin(0.5),
    );
  }

  // ---- Firma opcional del nombre ----------------------------------------------

  /** Subrayado + zona interactiva sobre la línea del nombre del diploma. */
  private buildNameZone(): void {
    const layout = VICTORY_LAYOUT;
    const zone = victoryNameZone();
    const content = this.modal?.content;
    if (!content) {
      return; // inalcanzable: la zona se construye tras crear el modal
    }

    // Subrayado bajo el nombre: invita a firmar (tinta tenue).
    const underline = this.add.graphics();
    underline.fillStyle(hexToNumber(layout.underline.color), layout.underline.alpha);
    underline.fillRect(
      zone.centerX - layout.underline.width / 2,
      zone.centerY + layout.underline.offsetY - layout.underline.height / 2,
      layout.underline.width,
      layout.underline.height,
    );
    content.add(underline);

    // Zona interactiva invisible (mismo patrón de hitArea explícita que el
    // velo del overlay de ACTION): tap → abrir la firma. Si ya está abierta
    // no hace nada: se cierra con Enter o tocando fuera (blur → commit).
    const signer = this.add
      .rectangle(zone.centerX, zone.centerY, zone.width, zone.height, hexToNumber(nightBackground), 0)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(
          -zone.width / 2,
          -zone.height / 2,
          zone.width,
          zone.height,
        ),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
    signer.on(Phaser.Input.Events.POINTER_DOWN, () => this.onSignerTap());
    content.add(signer);
  }

  /** Tap en la línea del nombre: crear (si falta) y abrir el input DOM. */
  private onSignerTap(): void {
    if (this.exiting) {
      return;
    }
    if (!this.nameField) {
      const layout = VICTORY_LAYOUT;
      const zone = victoryNameZone();
      this.nameField = new NameField(document, {
        getCanvasRect: (): DOMRect => this.game.canvas.getBoundingClientRect(),
        baseWidth: BASE_WIDTH,
        baseHeight: BASE_HEIGHT,
        center: { x: zone.centerX, y: zone.centerY },
        width: zone.width,
        height: zone.height,
        fontFamily: layout.nameInput.fontFamily,
        fontSize: layout.nameInput.fontSize,
        color: layout.nameInput.color,
        backgroundColor: layout.nameInput.backgroundColor,
        placeholder: layout.nameInput.placeholder,
        maxLength: layout.nameInput.maxLength,
        onInput: (value): void => {
          this.rawName = value;
        },
        onCommit: (value): void => this.commitName(value),
      });
      this.nameField.setValue(this.rawName);
    }
    if (!this.nameField.isVisible) {
      this.nameField.show();
    }
  }

  /** Enter o blur: oculta el input y re-pinta el diploma con el nombre. */
  private commitName(value: string): void {
    this.rawName = value;
    this.nameField?.hide();
    this.refreshDiploma();
    if (value.trim().length > 0) {
      this.systems.audioSystem.blip(); // confirmación sonora de la firma
    }
  }

  /** Re-pinta el cuerpo del diploma (diplomaText normaliza el nombre). */
  private refreshDiploma(): void {
    this.diplomaBody?.setText(diplomaText(this.rawName, this.total));
  }

  // ---- Desglose de puntaje + récord --------------------------------------------

  /** Placa inset oscura: 3 categorías + Total, y el récord debajo. */
  private buildBreakdown(
    breakdown: ScoreBreakdownView,
    finalScore: number,
    previousRecord: number,
  ): void {
    const layout = VICTORY_LAYOUT;
    const { plaque, breakdown: style } = layout;
    const content = this.modal?.content;
    if (!content) {
      return;
    }

    const plaqueHeight = breakdownPlaqueHeight();
    const left = layout.panel.centerX - plaque.width / 2;
    const top = plaque.topY;
    const g = this.add.graphics();
    g.fillStyle(hexToNumber(plaque.fill), 1);
    g.fillRoundedRect(left, top, plaque.width, plaqueHeight, plaque.cornerRadius);
    g.lineStyle(2, hexToNumber(plaque.stroke), plaque.strokeAlpha);
    g.strokeRoundedRect(
      left + 4,
      top + 4,
      plaque.width - 8,
      plaqueHeight - 8,
      Math.max(2, plaque.cornerRadius - 4),
    );
    content.add(g);

    const labelX = left + plaque.paddingX;
    const valueX = left + plaque.width - plaque.paddingX;
    const rowStyle = {
      fontFamily: style.fontFamily,
      fontSize: `${style.fontSize}px`,
      color: style.labelColor,
    };

    // Las tres líneas del desglose (taps + quiz + bonus, SPEC §6).
    breakdown.lines.forEach((line, index) => {
      const centerY = breakdownRowCenterY(index);
      content.add(this.add.text(labelX, centerY, line.label, rowStyle).setOrigin(0, 0.5));
      content.add(
        this.add
          .text(valueX, centerY, String(line.value), {
            ...rowStyle,
            color: style.valueColor,
          })
          .setOrigin(1, 0.5),
      );
    });

    // Separador + fila del Total (destaca en fuego de farola).
    const totalY = breakdownRowCenterY(3);
    const separatorY = totalY - plaque.rowHeightPx / 2;
    g.lineStyle(2, hexToNumber(style.separatorColor), style.separatorAlpha);
    g.lineBetween(labelX, separatorY, valueX, separatorY);
    content.add(
      this.add.text(labelX, totalY, VICTORY_LABELS.breakdownTotal, rowStyle).setOrigin(0, 0.5),
    );
    content.add(
      this.add
        .text(valueX, totalY, String(breakdown.total), {
          ...rowStyle,
          color: style.totalColor,
        })
        .setOrigin(1, 0.5),
    );

    // Rótulo del récord: verde success si el total SUPERABA al previo.
    content.add(
      this.add
        .text(layout.panel.centerX, layout.record.centerY, recordLabel(finalScore, previousRecord), {
          fontFamily: layout.record.fontFamily,
          fontSize: `${layout.record.fontSize}px`,
          color: isNewRecord(finalScore, previousRecord)
            ? layout.record.newRecordColor
            : layout.record.color,
        })
        .setOrigin(0.5),
    );
  }

  // ---- Botones de cierre --------------------------------------------------------

  private buildButtons(): void {
    const layout = VICTORY_LAYOUT;
    new GothicButton(this, layout.panel.centerX, layout.buttons.playAgainCenterY, {
      label: VICTORY_LABELS.playAgain,
      layout: VICTORY_BUTTON,
      onPress: (): void => this.onPlayAgain(),
    }).setDepth(layout.depths.ui);

    new GothicButton(this, layout.panel.centerX, layout.buttons.menuCenterY, {
      label: VICTORY_LABELS.backToMenu,
      layout: VICTORY_BUTTON,
      onPress: (): void => this.onBackToMenu(),
    }).setDepth(layout.depths.ui);
  }

  /**
   * «Jugar de nuevo»: descarta la TANDA (reset total + desglose por
   * categorías) y vuelve a NARRATIVE con {levelId}. El récord vive en el
   * save (lastScore = máx) y se conserva (SPEC §11).
   */
  private onPlayAgain(): void {
    if (this.exiting) {
      return;
    }
    this.exiting = true;
    this.systems.scoreSystem.reset();
    transitionTo(this, SceneKey.NARRATIVE, { levelId: this.level.id });
  }

  /**
   * «Volver al inicio»: el save ya quedó marcado al entrar (Completed = 1,
   * inProgress = false) — MENU no mostrará «Continuar» (SPEC §6/§11).
   */
  private onBackToMenu(): void {
    if (this.exiting) {
      return;
    }
    this.exiting = true;
    transitionTo(this, SceneKey.MENU);
  }
}
