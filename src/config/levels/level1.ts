/**
 * Nivel 1 — «La Transición y el Primer Escándalo» (SPEC §4, start.md):
 * TODO el contenido del nivel como DATOS, tipado contra `LevelConfig`.
 *
 * - lore: los 4 paneles de SPEC §4.1 (verbatim, ≤ 40 palabras cada uno).
 * - action: mecánica `tap-target` con los parámetros exactos de SPEC §4.2.
 * - quiz: pregunta y opciones VERBATIM de `start.md` / SPEC §4.3 (B es la
 *   correcta), feedback pedagógico por opción, y `storyFragment` adaptando
 *   el episodio del cheque de SPEC §4.4.
 */
import type { LevelConfig } from './types';

/**
 * Clave PLANIFICADA de la textura de la niña (silueta pequeña con farol
 * iluminado, SPEC §7.2). La textura se genera en la Etapa 4; se fija la
 * clave aquí para que config y arte no se desincronicen.
 */
export const GIRL_TEXTURE_KEY = 'girl';

export const level1: LevelConfig = {
  id: 1,
  title: 'La Transición y el Primer Escándalo',

  // Viñeta narrativa (SPEC §4.1; reencuadre familiar, decisión D4).
  lore: [
    {
      text: 'Londres, 188X. La niebla traga las farolas y los pasos suenan solos…',
      background: 'street',
    },
    {
      text: 'En su laboratorio, el Dr. Jekyll mezcla polvos púrpuras. Bebe. Y deja de ser él.',
      background: 'lab',
    },
    {
      text: 'Mr. Hyde camina por el callejón. Una niña con farol aparece en la esquina…',
      background: 'alley',
    },
    {
      // La instrucción de juego va entre **negritas** (así la marca SPEC §4.1):
      // `parseLoreSegments` la convierte en el tramo enfatizado del panel.
      text: '«Es hora del susto», susurra Hyde. **Tócala 3 veces antes de que la niebla lo cubra todo.**',
      background: 'alley',
    },
  ],

  // Minijuego de acción (SPEC §4.2).
  action: {
    mechanic: 'tap-target',
    target: {
      texture: GIRL_TEXTURE_KEY,
      speedRange: [120, 180], // px/s
      dirChangeMs: [800, 1500], // cambio aleatorio de dirección
    },
    goal: 3,
    timeLimitSec: 45,
    hudLabel: 'Sustos causados',
  },

  // Quiz literario (pregunta y opciones verbatim de start.md / SPEC §4.3).
  quiz: {
    question: '¿Cómo logra Mr. Hyde evitar ir preso tras el incidente con la niña?',
    options: [
      {
        text: 'Se escapa en un carruaje secreto hacia Francia.',
        feedback:
          'Hyde no huye de Londres. Todo lo contrario: sigue viviendo en la ciudad, y eso es lo que inquieta a Utterson…',
      },
      {
        text: 'Le da un cheque (firmado por el respetable Dr. Jekyll) al padre y a la familia de la niña para calmar el escándalo.',
        correct: true,
        feedback:
          '¡Correcto! Hyde entrega un cheque por 100 libras firmado por el estimado Dr. Jekyll, revelando la extraña conexión financiera entre ambos.',
      },
      {
        text: 'Soborna al inspector Newcomen con una gema preciosa.',
        feedback:
          'El inspector Newcomen sí investiga… pero mucho después. En este episodio el escándalo se cierra con dinero de Jekyll, no con sobornos policiales.',
      },
      {
        text: 'La policía lo confunde con un mendigo y lo deja ir.',
        feedback:
          'Nadie confunde a Hyde con un mendigo. Su problema es justo el contrario: hay testigos, y un cheque que lo señala…',
      },
    ],
    // Fragmento post-acierto (SPEC §4.4: el cheque, la firma, la sospecha).
    storyFragment:
      'Aquella noche, el señor Enfield detuvo a Hyde junto a la niña, que quedó asustada pero ilesa. ' +
      'Para calmar al padre y a la familia, Hyde entregó un cheque de cien libras… firmado por el respetable doctor Henry Jekyll. ' +
      'Cuando el abogado Utterson escuchó la historia, una duda helada se instaló en su despacho: ' +
      '¿por qué pagaba el doctor los errores de un hombre tan sombrío? ' +
      'La respuesta dormía, cerrada con llave, tras la puerta del laboratorio.',
  },
};
