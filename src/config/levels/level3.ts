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
 * - quiz: pregunta y opciones del material fuente (C es la correcta,
 *   adaptada al cómic: la confesión escrita del propio Jekyll), feedback
 *   pedagógico por opción, y `storyFragment` adaptando el episodio del
 *   sobre sellado con la confesión de Jekyll — el ÚNICO documento del cómic
 *   (pp. 36–37 y 63); no existe carta de Lanyon.
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

  // Quiz literario (pregunta y opciones del material fuente; la correcta
  // adaptada al cómic: la verdad llega por UNA confesión escrita de Jekyll).
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
          'Poole sí sospechó del sirviente enmascarado que se negaba a salir del gabinete, pero la verdad no llegó de palabra: llegó escrita, en el sobre sellado que esperaba en el laboratorio.',
      },
      {
        text: 'Mediante una confesión escrita por él mismo, hallada en un sobre sellado en el laboratorio.',
        correct: true,
        feedback:
          '¡Correcto! Junto a Hyde y un vial vacío esperaba un sobre sellado con cordón: la confesión completa de Henry Jekyll, que explica todo el tormento del doctor.',
      },
      {
        text: 'Lo cuenta por TikTok.',
        feedback:
          'En 188X no había redes sociales: solo sobres sellados, lacre y tinta. La confesión viajó en papel, no en pantallas.',
      },
    ],
    // Fragmento post-acierto: el sobre sellado con la confesión de Jekyll,
    // el ÚNICO documento del cómic (no hay carta de Lanyon).
    storyFragment:
      'Cuando la puerta del laboratorio cedió, Poole y Utterson entraron y solo encontraron un silencio espeso: Hyde yacía sin vida junto a un vial vacío, y del doctor Jekyll no quedaba rastro. ' +
      'Sobre la mesa esperaba un único sobre, sellado con cordón, que el inspector Newcomen llevó a Utterson. ' +
      'Era la confesión completa de Henry Jekyll: cómo la fórmula despertó a Hyde, cómo el placer de ser él lo fue consumiendo y cómo eligió desaparecer, cerrada con un «que Dios me dé fuerza» y su firma. ' +
      'Gracias a esas páginas, el lector conoce la verdad: Jekyll y Hyde fueron siempre la misma persona.',
  },
};
