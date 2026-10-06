/**
 * Nivel 2 — «El Persecutor del Callejón»: TODO el contenido del nivel como
 * DATOS, tipado contra `LevelConfig`.
 *
 * - lore: los 3 paneles del episodio de Lanyon (≤ 40 palabras cada uno).
 * - action: mecánica `cane-strike` — Hyde persigue al Dr. Lanyon entre la
 *   niebla y lo golpea 5 veces con su bastón de mango blanco. La textura
 *   'lanyon' y la del bastón se generan en la Fase 2 (aquí solo la clave).
 * - quiz: pregunta y opciones VERBATIM del material fuente (A es la
 *   correcta), feedback pedagógico por opción, y `storyFragment` adaptando
 *   el episodio de la carta de Lanyon y el bastón roto.
 */
import type { LevelConfig } from './types';

/**
 * Claves PLANIFICADAS de las texturas del Nivel 2 (el Dr. Lanyon y el bastón
 * de mango blanco). Se generan en la Fase 2; se fijan aquí para que config y
 * arte no se desincronicen (mismo patrón que `GIRL_TEXTURE_KEY`).
 */
export const LANYON_TEXTURE_KEY = 'lanyon';
export const CANE_TEXTURE_KEY = 'cane';

export const level2: LevelConfig = {
  id: 2,
  title: 'El Persecutor del Callejón',

  // Viñeta narrativa: meses después, la fórmula ya vive dentro de Jekyll.
  lore: [
    {
      text: 'Pasan los meses. Una noche, el Dr. Jekyll se transforma en Hyde sin beber la poción… la fórmula ya vive dentro de él.',
      background: 'street',
    },
    {
      text: 'El doctor Lanyon camina solo por el callejón. Hyde lo reconoce y lo persigue entre la niebla.',
      background: 'alley',
    },
    {
      text: 'Hyde desenvaina su bastón de mango blanco. **Golpéalo 5 veces antes de que la niebla lo cubra todo.**',
      background: 'alley',
    },
  ],

  // Minijuego de acción: bastonazos sobre un objetivo que huye más rápido.
  action: {
    mechanic: 'cane-strike',
    target: {
      texture: LANYON_TEXTURE_KEY,
      speedRange: [150, 220], // px/s (más rápido que el N1)
      dirChangeMs: [600, 1200], // cambia de dirección más a menudo que el N1
    },
    goal: 5,
    timeLimitSec: 60,
    hudLabel: 'Bastonazos',
    caneTexture: CANE_TEXTURE_KEY,
    victoryLine: '¡De parte nuestra! Jajajaja.',
  },

  // Quiz literario (pregunta y opciones verbatim del material fuente).
  quiz: {
    question: '¿Por qué Hyde mató al Dr. Lanyon?',
    options: [
      {
        text: 'Porque Lanyon se burló de su experimento diciéndole: ¡Adiós! ¡De parte nuestra!',
        correct: true,
        feedback:
          'En la novela, Lanyon presenció la transformación de Jekyll en Hyde y el choque de aquel secreto le costó muy caro: Hyde lo abatió en el callejón, despidiéndose con ese grito burlón.',
      },
      {
        text: 'Porque le debía dinero.',
        feedback:
          'Hyde no actuaba por deudas: el rencor de Lanyon venía de la ciencia de Jekyll y del secreto terrible que sus propios ojos presenciaron.',
      },
      {
        text: 'Porque le mató a su perrito.',
        feedback:
          'No hay ningún perrito en la novela: la crueldad de Hyde era contra las personas que se cruzaban en su camino, no contra los animales.',
      },
      {
        text: 'Porque le quiso dar la mano para saludarlo y Lanyon le hizo «osooo».',
        feedback:
          'Un saludo torpe no asusta a nadie en la novela: lo que acabó con Lanyon fue el horror de ver la transformación con sus propios ojos.',
      },
    ],
    // Fragmento post-acierto: la carta de Lanyon, el bastón roto, la conexión.
    storyFragment:
      'El bastón de mango blanco quedó roto en dos sobre el empedrado del callejón. ' +
      'Sacudido por lo que había presenciado, el doctor Lanyon selló una carta para su amigo Utterson: solo podría abrirla cuando la sombra de Jekyll lo alcanzara también a él. ' +
      'Dentro del sobre dormía una promesa inquietante: la verdad sobre Hyde estaba escrita, y llevaba la firma del respetable doctor Henry Jekyll.',
  },
};
