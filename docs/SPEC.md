# SPEC — Juego didáctico web: *Dr. Jekyll & Mr. Hyde* (título provisional [TBD])

> **Tipo de documento:** Especificación funcional y técnica (fuente de verdad del proyecto).
> **Documento origen del pedido:** [`start.md`](../start.md)
> **Plan de desarrollo asociado:** [`docs/PLAN.md`](./PLAN.md)
> **Versión:** 1.0 · **Fecha:** 2026-10-02

---

## 1. Visión y objetivo pedagógico

Videojuego web **100 % client-side** que evalúa si el jugador leyó la novela clásica
*El extraño caso del Dr. Jekyll y Mr. Hyde* de Robert Louis Stevenson. Cada nivel alterna:

1. Una **fase narrativa** (viñeta que sitúa al jugador en el contexto del nivel).
2. Una **fase de acción arcade** (tap/clic sobre un objetivo en escena, con tiempo límite).
3. Una **fase de evaluación** (quiz de opción múltiple basado estrictamente en la trama del libro).

- **Público objetivo:** familiar / mixto, **10 años o más**. Lenguaje medio, textos cortos.
- **Tono:** gótico victoriano, lúgubre pero amable. **La violencia del libro se sugiere, nunca se muestra.**
- **Idioma:** español (contenidos y UI).
- **Plataformas:** navegadores móviles (táctil) y de escritorio (mouse), indistintamente.

### 1.1 Título del juego — [TBD]

Pendiente de decisión. Candidatos sugeridos:

| # | Candidato | Estilo |
|---|-----------|--------|
| 1 | *Jekyll & Hyde: Sombras de Londres* | Evocador, familiar |
| 2 | *La Poción del Dr. Jekyll* | Misterioso, directo |
| 3 | *El Caso Jekyll & Hyde* | Expediente / detective |

Hasta que se decida, todos los documentos usan el placeholder **«Jekyll & Hyde [TBD]»**.

---

## 2. Registro de decisiones

Decisiones cerradas con el solicitante (y diferencias respecto al pedido original de `start.md`):

| # | Tema | Decisión | Nota / desvío respecto a `start.md` |
|---|------|----------|--------------------------------------|
| D1 | Motor | **Phaser 4** (v4.2.x, npm `phaser`) | `start.md` pedía JS vanilla + DOM; se reemplaza por Phaser 4. |
| D2 | Lenguaje | **TypeScript** + Vite | El starter oficial Phaser 4 usa Vite + TS. Sin React: toda la UI vive dentro de Phaser (canvas), no en DOM. |
| D3 | Alcance v1 | **Solo Nivel 1 completo**; arquitectura data-driven para sumar niveles después | `start.md` diseñaba 3 niveles; niveles 2 y 3 quedan como *roadmap* (§12). |
| D4 | Tono | **Familiar 10+**: violencia sugerida, nunca mostrada | Reencuadre no violento de las mecánicas (§4.2). |
| D5 | Fallo en el quiz | **Respuesta incorrecta → reinicia el nivel completo** (narrativa + minijuego + quiz). Feedback pedagógico siempre | `start.md` permitía reintentar la pregunta; el solicitante eligió el reinicio completo. Consecuencia: no hay puntos decrecientes por reintento. |
| D6 | Timer minijuego N1 | **Sí, tiempo generoso: 45 s**, contador visible | Agotado el tiempo → reintenta **solo el minijuego** (no el nivel). |
| D7 | Puntuación | Puntos con bonus (§5): tap exitoso 10 pts · quiz correcto 100 pts · bonus por tiempo restante 2 pts/s | Complementa D5: el bonus vive en la rapidez del minijuego, no en reintentos del quiz. |
| D8 | Arte | **100 % procedural** (texturas generadas en código con Phaser Graphics) | Cero archivos de imagen, cero licencias de assets. |
| D9 | Audio | **Web Audio API sintetizado** (osciladores) + toggle mute persistente | Coincide con la opción de `start.md`. |
| D10 | Formato de docs | Markdown en el repo | — |

---

## 3. Flujo de estados del juego

Máquina de estados (herencia conceptual de `start.md`) **mapeada 1:1 a escenas Phaser**:

```
BOOT ──► PRELOAD ──► MENU ──► NARRATIVE ──► ACTION ──► QUIZ ──► VICTORY
                       ▲          │            │            │
                       │          │            │            ├─ ✔ correcta → VICTORY
                       │          │            │            └─ ✘ incorrecta → reinicio de NIVEL
                       │          │            └── timeout ──► GAME_OVER ──► reintentar ACTION
                       │          └── "Continuar" (si hay save)
                       └───────────────── reinicio de nivel (D5) ─────────────────┘
```

| Estado (Phaser Scene) | Descripción | Salidas |
|---|---|---|
| `BOOT` | Init: genera texturas procedurales, crea sistemas (save/audio/score). | → `PRELOAD` |
| `PRELOAD` | Carga tipografías web (Google Fonts) con pantalla mínima. | → `MENU` |
| `MENU` | Splash gótico: título, «Comenzar el viaje», «Cómo jugar», «Continuar» si hay save. | → `NARRATIVE` |
| `NARRATIVE` | Viñeta del nivel (paneles de texto + arte de fondo), avance por tap. | → `ACTION` |
| `ACTION` | Minijuego arcade del nivel (§4.2). | meta → `QUIZ` · timeout → `GAME_OVER` |
| `GAME_OVER` | Overlay animoso: «La niebla lo ocultó todo… ¡inténtalo de nuevo!». **No es fin de partida.** | → reintentar `ACTION` (mismo nivel) |
| `QUIZ` | Modal de evaluación literaria (§4.3). | ✔ → `VICTORY` (v1, único nivel) · ✘ → reinicio de nivel → `NARRATIVE` |
| `VICTORY` | Diploma + resumen de puntaje. Reset de progreso / rejugar. | → `MENU` |

**Regla de reinicio de nivel (D5):** al fallar el quiz se muestra el feedback pedagógico, se
**descartan los puntos ganados en esa tanda del nivel** y el flujo vuelve a `NARRATIVE`
(con avance rápido/skip disponible para no frustrar).

---

## 4. Nivel 1 — diseño detallado (alcance v1)

### 4.1 Lore / Contexto (tono adaptado, D4)

El Dr. Henry Jekyll experimenta en su laboratorio con polvos misteriosos hasta dar con la fórmula
que libera su lado oscuro: Mr. Hyde. Una noche, Hyde vagabundea por las calles oscuras de Londres
y se produce un **encontronazo** con una niña en un callejón: ella sale ilesa pero muy asustada,
y el escándalo desata una investigación que revela una extraña conexión entre Hyde y el respetable
Dr. Jekyll.

**Viñeta narrativa (paneles; redacción definitiva a pulir en implementación):**

1. *Londres, 188X. La niebla traga las farolas y los pasos suenan solos…*
2. *En su laboratorio, el Dr. Jekyll mezcla polvos púrpuras. Bebe. Y deja de ser él.*
3. *Mr. Hyde camina por el callejón. Una niña con farol aparece en la esquina…*
4. *«Es hora del susto», susurra Hyde. **Tócala 3 veces antes de que la niebla lo cubra todo.***

### 4.2 Mecánica de acción

| Parámetro | Valor |
|---|---|
| Escena | Callejón londinense procedural: farolas parpadeantes, edificios en silueta, niebla en capas (§7) |
| Objetivo | La **niña** (silueta con farol) que se desplaza **erráticamente** por el callejón |
| Interacción | Tap / clic **sobre la niña** (hitbox generosa: +20 % del sprite, apropiada para dedos de niños) |
| Meta | **3 taps exitosos** → HUD «Sustos causados: X/3» |
| Tiempo límite | **45 s** con contador visible (barra + número); sonido *tick* en los últimos 5 s |
| Movimiento de la niña | Velocidad 120–180 px/s; cambio aleatorio de dirección cada 0,8–1,5 s; rebota en los bordes de la zona de juego |
| Feedback por tap exitoso | Flash + *shake* de cámara suave, exclamación «!» sobre la niña, «+10» flotante, sonido *tap*; la niña «sale corriendo asustada pero ilesa» |
| Feedback por tap fallido (al aire) | Puff de niebla en el punto tocado; **sin penalización** |
| Al lograr 3/3 | La niña huye de la pantalla asustada (pero ilesa) → transición → `QUIZ` |
| Timeout (0 s) | Overlay `GAME_OVER` → botón «Reintentar» → reinicia **solo el minijuego** (contador y timer a cero) |

**Reencuadre de tono (D4):** el «atropello/pisoteo» del libro se abstrae como un juego de sustos y
escondites en la niebla. Nunca hay contacto dañino visible ni sangre; el quiz, en cambio, sí evalúa
el episodio real del libro (el cheque).

### 4.3 Quiz literario (post-acción)

Pregunta y opciones **verbatim de `start.md`**:

> **¿Cómo logra Mr. Hyde evitar ir preso tras el incidente con la niña?**
>
> - **A)** Se escapa en un carruaje secreto hacia Francia.
> - **B)** Le da un cheque (firmado por el respetable Dr. Jekyll) al padre y a la familia de la niña para calmar el escándalo. ✔
> - **C)** Soborna al inspector Newcomen con una gema preciosa.
> - **D)** La policía lo confunde con un mendigo y lo deja ir.

**Feedback pedagógico por opción** (redacción definitiva a pulir):

| Opción | Tipo | Feedback |
|---|---|---|
| A | ✘ | «Hyde no huye de Londres. Todo lo contrario: sigue viviendo en la ciudad, y eso es lo que inquieta a Utterson…» |
| **B** | ✔ | «¡Correcto! Hyde entrega un cheque por 100 libras firmado por el estimado Dr. Jekyll, revelando la extraña conexión financiera entre ambos.» *(verbatim de `start.md`)* + fragmento de historia (§4.4) |
| C | ✘ | «El inspector Newcomen sí investiga… pero mucho después. En este episodio el escándalo se cierra con dinero de Jekyll, no con sobornos policiales.» |
| D | ✘ | «Nadie confunde a Hyde con un mendigo. Su problema es justo el contrario: hay testigos, y un cheque que lo señala…» |

**Flujo:** respuesta incorrecta → modal de feedback (2–3 líneas) → botón «Volver a empezar el
nivel» → reinicio del nivel completo (D5). Respuesta correcta → +100 pts → panel con fragmento de
la historia (§4.4) → `VICTORY` (v1).

### 4.4 Fragmento de historia post-acierto

Extracto/adaptación breve del episodio (el cheque por 100 libras, la firma de Jekyll, la sospecha
de Utterson) mostrado en un panel con estética de carta antigua antes de pasar a `VICTORY`.
Redacción definitiva a pulir en implementación.

---

## 5. Sistema de puntuación

| Evento | Puntos |
|---|---|
| Tap exitoso sobre el objetivo | **+10** (x3 = 30 máx.) |
| Quiz respondido correctamente | **+100** (todo o nada; un fallo reinicia el nivel — D5/D7) |
| Bonus por tiempo restante al lograr la meta | **+2 por segundo** restante del timer (máx. teórico +90) |
| Tap fallido | 0 (sin castigo) |
| Timeout | 0 (reintento del minijuego; se descartan los puntos de esa tanda) |
| Reinicio de nivel por quiz fallido | Se descartan **todos** los puntos ganados en esa tanda del nivel |

- **Puntaje máximo teórico del Nivel 1:** ~**220 pts** (30 + 100 + 90).
- El puntaje se muestra en HUD durante `ACTION` y `QUIZ`, y en el resumen final (desglosado).
- El bonus por tiempo conserva el espíritu «puntos con bonus» (D7), dado que el reintento del quiz
  ya no existe como mecanismo (D5).

---

## 6. Pantallas (UI)

| Pantalla | Contenido | Requisitos |
|---|---|---|
| **Splash / Menu** | Título gótico animado (niebla), subtítulo «Una aventura por el libro de R. L. Stevenson», botones «Comenzar el viaje», «Cómo jugar», «Continuar» (solo si hay partida en curso) | Botón primario ≥ 64 px de alto; título con fade-in |
| **Cómo jugar** | 3 ilustraciones/iconos procedurales: 1) lee la viñeta, 2) toca al objetivo, 3) responde el quiz | Cerrable; accesible desde Menu |
| **Narrativa** | Paneles de texto sobre fondo del callejón/laboratorio, avance por tap, botón «Saltar» | Texto máx. ~40 palabras por panel; tipografía serif legible |
| **Acción (N1)** | HUD superior: contador «Sustos causados: X/3», timer (barra + segundos), puntaje; botón pausa (vuelve a Menu guardando progreso de nivel) | Timer en rojo y con *tick* en los últimos 5 s |
| **Quiz** | Modal centrado tipo pergamino/cartas antiguas: pregunta, 4 opciones (A–D) como tarjetas, feedback inline | Opciones ≥ 56 px de alto; nunca se cierra sin feedback |
| **GAME_OVER (timeout)** | Overlay: «La niebla lo ocultó todo… ¡inténtalo de nuevo!» + botón «Reintentar» | Tono animoso; sin «perdiste» en rojo agresivo |
| **Victoria** | Diploma generado (nombre del jugador opcional vía input simple), puntaje final desglosado (taps + quiz + bonus), botones «Jugar de nuevo» y «Volver al inicio» | Reset de progreso al rejugar |

---

## 7. Dirección de arte (100 % procedural — D8)

Sin archivos de imagen: todas las texturas se generan en código (`Phaser.GameObjects.Graphics`
→ `generateTexture`) en `BootScene`, y se consumen como sprites normales.

### 7.1 Paleta gótica (códigos hex; fuente de verdad en `src/config/palette.ts`)

| Uso | Color |
|---|---|
| Fondo noche / cielo | `#0d0f14` |
| Niebla (lejos → cerca) | `#3a4048` · `#565e68` · `#78818c` |
| Edificios en silueta | `#1a1d24` |
| Calle / adoquines | `#23262e` |
| Verde laboratorio (acentos) | `#4f7a5c` |
| Sepia pergamino (UI/quiz) | `#d8c9a3` sobre `#2b2620` |
| Fuego de farola / farol de la niña | `#e8b45a` |
| Púrpura poción (acentos narrativa) | `#7a4f8f` |
| Texto principal | `#e8e3d5` sobre fondos oscuros |
| Éxito / error (feedback) | `#7fb069` / `#b05a5a` (desaturados, no agresivos) |

### 7.2 Técnicas por elemento

- **Callejón (parallax 3 capas):** siluetas de edificios generadas con rectángulos irregulares;
  capas de niebla = sprites grandes de gradiente radial difuso con deriva sinusoidal y opacidad
  baja; farolas = silueta + halo con variación aleatoria de opacidad (parpadeo).
- **Personajes:** siluetas vectoriales reconocibles — Hyde (sombrero de copa, gabán, alto y
  delgado) y la niña (silueta pequeña con farol iluminado, su punto focal visual).
- **Estados de acierto:** flash blanco breve, «!» flotante, micro-shake de cámara (≤ 150 ms, suave).
- **UI gótica:** marcos tipo pergamino (rectángulos redondeados + borde doble sepia); botones con
  estados hover/active (desktop) y pressed (táctil).
- **Animaciones clave:** niebla en deriva perpetua; farolas con flicker; transiciones de escena
  con fade + wipe de niebla; timer con pulso cuando quedan ≤ 5 s.

### 7.3 Tipografía

- **Títulos:** gótica legible tipo *UnifrakturCook* o *Pirata One* (Google Fonts) — validar
  legibilidad infantil; alternativa segura: *IM Fell English SC*.
- **Cuerpo/UI:** *Special Elite* (typewriter) para textos de época y *Crimson Text* para bloques
  largos.
- Carga con `FontFace`/CSS preload antes de crear textos (en `PRELOAD`); fallback `Georgia, serif`.

---

## 8. Audio (Web Audio API sintetizado — D9)

| Sonido | Síntesis propuesta |
|---|---|
| Tap exitoso | Oscilador triangular, pitch descendente corto (thump) + click |
| Tap fallido | Ruido blanco filtrado low-pass, muy breve (puff de niebla) |
| Acierto quiz | Arpegio mayor breve (2–3 notas) |
| Error quiz | Intervalo menor descendente, suave |
| Tick del timer (últimos 5 s) | Click corto cada segundo |
| Timeout | Tono grave sostenido con decay |
| Transición de escena | Sweep de ruido filtrado (viento) |

- **`AudioSystem`** único (singleton); el `AudioContext` se crea/resume en el primer gesto del
  usuario (políticas de autoplay).
- **Toggle mute persistente** (icono altavoz en Menu y HUD), guardado en localStorage.

---

## 9. UX, responsive y accesibilidad

- **Mobile-first:** diseño base vertical **720 × 1280**, `Phaser.Scale.FIT` + `CENTER_BOTH`;
  en desktop se centra con *letterbox* decorado (textura de niebla oscura, no barras negras duras).
- **Input unificado:** `pointerdown` (funciona igual para tap y clic). Ninguna acción esencial
  depende de hover.
- **Botones grandes:** primarios ≥ 64 px de alto, opciones de quiz ≥ 56 px, hitboxes generosas.
- **Textos cortos** (máx. ~40 palabras por panel narrativo), vocabulario 10+.
- **Sin frustración:** timeouts generosos, feedback siempre explicativo, GAME_OVER con tono animoso.
- **Contraste:** texto `#e8e3d5` sobre fondos ≤ `#23262e` (ratio alto en cuerpos de texto).
- **Pausa implícita:** cerrar pestaña / recargar no pierde el nivel alcanzado (§11).
- Funciona **offline tras la primera carga** (todo client-side; PWA/sw-cache como mejora post-v1).

---

## 10. Arquitectura técnica

### 10.1 Stack

| Capa | Tecnología |
|---|---|
| Motor | **Phaser 4** (v4.2.x, paquete npm `phaser`) |
| Lenguaje | **TypeScript** (strict) |
| Build / dev | **Vite** |
| UI del juego | Dentro de Phaser (canvas). **Sin React** ni framework de DOM |
| Fuentes | Google Fonts (link + `FontFace` load) |
| Persistencia | `localStorage` |
| Deploy | Estático (GitHub Pages / Vercel / Netlify), sin backend |

Scaffold: `npm create vite@latest` (plantilla vanilla-ts) + `npm i phaser`.
*(El starter oficial `npm create @phaserjs/game@latest` es React-based; se descarta por D2.)*

### 10.2 Estructura de carpetas

```
src/
├── main.ts                     # bootstrap: new Phaser.Game(config)
├── config/
│   ├── palette.ts              # colores (§7.1)
│   ├── game.config.ts          # Phaser config (scale FIT, scenes)
│   └── levels/
│       ├── types.ts            # LevelConfig, ActionConfig, QuizConfig, LorePanel
│       ├── level1.ts           # TODO el contenido del Nivel 1 como DATOS
│       └── index.ts            # registro ordenado de niveles
├── scenes/
│   ├── BootScene.ts            # genera texturas procedurales + init sistemas
│   ├── PreloadScene.ts         # fuentes web + splash mínimo
│   ├── MenuScene.ts
│   ├── NarrativeScene.ts       # genérica: renderiza el lore del LevelConfig
│   ├── ActionScene.ts          # genérica: ejecuta el ActionConfig del nivel
│   ├── QuizScene.ts            # genérica: renderiza el QuizConfig
│   └── VictoryScene.ts
├── systems/
│   ├── SaveSystem.ts           # localStorage (§11)
│   ├── AudioSystem.ts          # Web Audio sintetizado (§8) + mute
│   └── ScoreSystem.ts          # puntaje de la tanda + eventos
├── ui/
│   ├── GothicButton.ts
│   ├── Panel.ts                # marcos pergamino
│   ├── Modal.ts
│   └── Hud.ts                  # contador de meta + timer bar + score
└── art/
    └── textures.ts             # fábrica de texturas procedurales (Graphics → generateTexture)
```

### 10.3 Data-driven: `LevelConfig`

Todo el contenido de un nivel es **datos**, no código. Añadir niveles 2 y 3 = añadir archivos de
configuración; las mecánicas nuevas se modelan con una unión discriminada por `mechanic`.

```ts
interface LevelConfig {
  id: number;
  title: string;
  lore: LorePanel[];                       // texto + fondo procedural por panel
  action: ActionConfig;                    // unión discriminada por `mechanic`
  quiz: QuizConfig;
}

interface TapTargetActionConfig {          // mecánica del Nivel 1 (v1)
  mechanic: 'tap-target';
  target: { texture: string; speedRange: [number, number]; dirChangeMs: [number, number] };
  goal: number;                            // taps requeridos (3)
  timeLimitSec: number;                    // 45
  hudLabel: string;                        // "Sustos causados"
}

interface QuizConfig {
  question: string;
  options: { text: string; correct?: boolean; feedback: string }[];
  storyFragment: string;                   // se muestra al acertar
}
```

`NarrativeScene`, `ActionScene` y `QuizScene` son **genéricas**: leen el `LevelConfig` activo desde
un `LevelRegistry`. Este es el mecanismo de extensibilidad (D3).

### 10.4 Notas Phaser 4

- Phaser 4 reconstruyó el renderer WebGL manteniendo la API de escenas/input/tweens esencialmente
  compatible con Phaser 3; la mayor parte de tutoriales online son de Phaser 3 — **verificar cada
  API contra la documentación oficial 4.x** durante la implementación (riesgo §13).
- `Scale.FIT` + `CENTER_BOTH`; resolución base 720×1280.
- Partículas de niebla: pool acotado (≤ 30 sprites grandes suaves), sin generación de texturas
  por frame.

---

## 11. Persistencia (`localStorage`)

Clave única `jekyll_hyde_save_v1` (JSON):

```ts
interface SaveData {
  levelsCompleted: number;   // niveles terminados (v1: 0 | 1)
  lastScore: number;         // mejor puntaje registrado
  muted: boolean;
  inProgress: boolean;       // partida empezada y no terminada (habilita «Continuar»)
}
```

- Se guarda al: comenzar nivel, completar quiz correcto, terminar partida, toggle de mute.
- «Continuar» en Menu visible solo si `inProgress === true` (v1: reaparece en la narrativa del N1).
- Al completar `VICTORY`, el save conserva `lastScore` como récord; «Jugar de nuevo» resetea la tanda.
- Save corrupto o ausente ⇒ arranque limpio sin errores (try/catch + valores por defecto).

---

## 12. Extensibilidad / Roadmap (fuera de v1)

Diseño ya existente en `start.md`, listo para implementarse como nuevos `LevelConfig`:

| Nivel | Mecánica nueva (`ActionConfig`) | Quiz |
|---|---|---|
| **2 — El Asaltante de la Niebla** (Sir Danvers Carew) | `chase-escape`: el objetivo cruza la pantalla y **escapa** si sale de ella; 5 taps antes del escape; presión por posición, no por timer | Objeto que vincula a Hyde con el crimen (bastón partido) |
| **3 — El Secreto del Gabinete** | `collect-falling`: 5 frascos de poción caen desde la mesa del laboratorio; tap antes de que desaparezcan; timer | Cómo se revelan los hechos (carta de Lanyon + confesión de Jekyll) |

Otras extensiones contempladas: banco de preguntas por nivel (pool aleatorio), i18n, música de
ambiente, PWA offline.

---

## 13. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| APIs Phaser 4 distintas a la documentación/tutoriales Phaser 3 que circulan | Medio | Verificar contra docs/ejemplos oficiales 4.x; probar cada API en aislamiento antes de integrarla |
| Performance de niebla/partículas en móviles de gama baja | Medio | Pool limitado, sprites grandes con blending simple, medir FPS en device real (Etapa 4 del plan) |
| Fuentes web tardías → textos con fallback feo | Bajo | `FontFace.load` en `PRELOAD` con timeout y fallback serif aceptable |
| Políticas de autoplay de audio | Bajo | `AudioContext` creado en el primer gesto del usuario |
| Hitbox pequeña frustra a niños | Medio | Hitbox +20 %; prueba táctil real (Etapa 7 del plan) |
| Contenido sensible (novela violenta) | Alto | Reencuadre D4 ya aplicado; revisión de textos por un adulto/educador antes de publicar |

---

## 14. Fuera de alcance v1

- Niveles 2 y 3 implementados (solo roadmap, §12).
- Multiidioma (i18n).
- Backend, cuentas, analytics, ranking online.
- Música de fondo compuesta (solo SFX sintetizados).
- Arte de illustrator / assets externos (el pipeline procedural es definitivo para v1).
- PWA / instalable (opcional post-v1).
