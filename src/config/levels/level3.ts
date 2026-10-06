/**
 * Nivel 3 — «El Asedio al Laboratorio»: TODO el contenido del nivel como
 * DATOS, tipado contra `LevelConfig`.
 *
 * - lore: los 3 paneles del episodio final (Poole y Utterson fuerzan la
 *   puerta; ≤ 40 palabras cada uno).
 * - action: mecánica `transform-target` — el objetivo alterna Hyde↔Jekyll;
 *   tras cada golpe Hyde se vuelve Jekyll (invulnerable) 3 segundos, así que
 *   solo cuentan los golpes con eltiming correcto. Las texturas 'hyde' y
 *   'jekyll' ya existen (intro).
 * - quiz: pregunta y opciones VERBATIM del material fuente (C es la
 *   correcta), feedback pedagógico por opción, y `storyFragment` adaptando
 *   el episodio de las cartas sobre el escritorio.
 */
import type { LevelConfig } from './types';

/** Nivel 3 — «El Asedio al Laboratorio». */
export const level3: LevelConfig = {
  id: 3,
  title: 'El Asedio al Laboratorio',

  // Viñeta narrativa: la puerta cerrada desde dentro y el asedio final.
  lore: [
    {
      text: 'El laboratorio amanece cerrado con llave desde dentro. Algo golpea la puerta con furia.',
      background: 'street',
    },
    {
      text: 'Poole, el mayordomo, y el abogado Utterson la fuerzan desde afuera. Adentro, algo se retuerce…',
      background: 'street',
    },
    {
      text: 'Adentro está Hyde. Cada bastonazo lo vuelve el doctor Jekyll… pero a los 3 segundos vuelve a ser Hyde. **Golpéalo 6 veces.**',
      background: 'lab',
    },
  ],

  // Minijuego de acción: golpes a Hyde entre transformaciones (ventana de 3 s).
  action: {
    mechanic: 'transform-target',
    target: {
      textureHyde: 'hyde', // ya existe en el registro (intro)
      textureJekyll: 'jekyll', // ya existe en el registro (intro)
      speedRange: [110, 170], // px/s
      dirChangeMs: [700, 1300], // cambio aleatorio de dirección
    },
    revertMs: 3000,
    goal: 6,
    timeLimitSec: 90,
    hudLabel: 'Golpes a Hyde',
  },

  // Quiz literario (pregunta y opciones verbatim del material fuente).
  quiz: {
    question: '¿De qué forma el Dr. Jekyll confiesa que él es Hyde?',
    options: [
      {
        text: 'En un interrogatorio policial.',
        feedback:
          'Nadie interroga a Jekyll ni a Hyde: cuando la puerta del laboratorio cede, la escena ya se ha cerrado y la verdad no llega por boca de un policía.',
      },
      {
        text: 'Se lo dice en secreto a Poole y este se lo cuenta a todo el mundo.',
        feedback:
          'Poole sí sospechó del sirviente enmascarado que se negaba a salir del gabinete, pero la verdad no llegó de palabra: llegó por escrito, al despacho de Utterson.',
      },
      {
        text: 'Mediante una carta escrita a su amigo Utterson.',
        correct: true,
        feedback:
          '¡Correcto! La confesión final de Jekyll llega sellada al abogado, junto a la carta de Lanyon, y explica todo el tormento: el placer y la culpa de haber sido Hyde.',
      },
      {
        text: 'Lo cuenta por TikTok.',
        feedback:
          'En 188X no había redes sociales: solo sobres sellados, lacre y tinta. La confesión viajó en papel, no en pantallas.',
      },
    ],
    // Fragmento post-acierto: las dos cartas sobre el escritorio del doctor.
    storyFragment:
      'Cuando la puerta del laboratorio cedió, Poole y Utterson entraron al gabinete y solo encontraron un silencio espeso. ' +
      'Sobre el escritorio esperaban dos documentos: la carta del doctor Lanyon y una confesión firmada por Henry Jekyll. ' +
      'En ella, el doctor relataba todo el tormento: cómo la fórmula despertó a Hyde, cómo el placer de ser él lo fue consumiendo y cómo eligió desaparecer para que la historia terminara. ' +
      'Gracias a esas páginas, el lector conoce la verdad completa: Jekyll y Hyde fueron siempre la misma persona.',
  },
};
