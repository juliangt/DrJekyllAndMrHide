# PLAN — Desarrollo por etapas · *Jekyll & Hyde [TBD]*

> **Documento hermano de:** [`docs/SPEC.md`](./SPEC.md) (fuente de verdad de diseño).
> **Versión:** 1.0 · **Fecha:** 2026-10-02
> **Alcance del desarrollo:** v1 = Nivel 1 completo (decisión D3 de la SPEC).

---

## 1. Resumen

Construcción del juego web didáctico con **Phaser 4 + TypeScript + Vite**, en 8 etapas secuenciales.
Cada etapa produce un incremento jugable o verificable, con **criterio de aceptación (CA)
objetivo**: si el CA no se cumple, la etapa no está terminada. Las estimaciones son
**horas-ideales** (sin contar interrupciones ni aprendizaje de APIs).

---

## 2. Etapas

### Etapa 0 — Setup del proyecto · `S` · ~2–3 h

**Objetivo:** repositorio ejecutable con la base técnica y el pipeline de deploy.

Tareas:
1. `npm create vite@latest` (plantilla vanilla-ts) + `npm i phaser`.
2. `tsconfig` en modo strict; scripts `dev` / `build` / `preview`.
3. Estructura de carpetas de la SPEC §10.2 (vacía, con archivos placeholder).
4. `index.html` con viewport mobile, Google Fonts enlazadas (SPEC §7.3) y fondo oscuro.
5. Config de deploy estático (GitHub Pages o Vercel/Netlify).
6. README mínimo (cómo correr el proyecto, link a SPEC y PLAN).

**Entregable:** proyecto que corre en local.
**CA:** `npm run dev` abre el canvas Phaser escalado y centrado (pantalla de color base) en un
móvil y en desktop; `npm run build` + `preview` funciona sin errores; `tsc` pasa sin errores.

---

### Etapa 1 — Fundaciones · `M` · ~4–6 h

**Objetivo:** núcleo reutilizable por todas las escenas.

Tareas:
1. `config/game.config.ts`: `Phaser.Game` con `Scale.FIT` + `CENTER_BOTH`, base 720×1280,
   registro de las 8 escenas (aún vacías).
2. `config/palette.ts` con los hex de la SPEC §7.1.
3. `art/textures.ts`: primera hornada de texturas procedurales — gradiente de niebla, silueta de
   edificio, farola, «puff» de niebla, marco pergamino.
4. `systems/SaveSystem.ts`: esquema `jekyll_hyde_save_v1` con try/catch + defaults.
5. `systems/AudioSystem.ts`: AudioContext lazy (primer gesto), primitivas de síntesis
   (blip, thump, noise), mute persistente.
6. `systems/ScoreSystem.ts`: puntaje de tanda, eventos de incremento, reset.
7. Navegación entre escenas vacías con transición fade (verificar APIs de transición en docs 4.x).
8. `config/levels/types.ts` + `level1.ts` con los DATOS completos del Nivel 1 (lore, acción, quiz —
   SPEC §4) y `index.ts` como registro.

**Entregable:** esqueleto navegable con sistemas vivos.
**CA:** desde Boot se llega a cada escena vacía por orden; recargar la página conserva un valor de
prueba escrito por `SaveSystem`; al togglear mute y recargar, el estado persiste; el JSON del
Nivel 1 tipa sin errores contra `LevelConfig`.

---

### Etapa 2 — Splash / Menu · `S` · ~3–4 h

**Objetivo:** primera pantalla real con identidad gótica.

Tareas:
1. `MenuScene`: fondo de callejón con niebla en deriva (parallax), título con fade-in
   (placeholder «Jekyll & Hyde [TBD]»), subtítulo.
2. `ui/GothicButton.ts` (estados hover/pressed, ≥ 64 px) y botones «Comenzar el viaje»,
   «Cómo jugar», «Continuar» (condicional a `inProgress`).
3. Pantalla «Cómo jugar» con 3 iconos procedurales (leer → tocar → responder).
4. Toggle de mute (icono altavoz) visible.
5. Sonido de viento en la entrada al menú (si el gesto ya habilitó el audio).

**Entregable:** menú completo funcional.
**CA:** «Comenzar» lleva a `NARRATIVE`; con save `inProgress`, «Continuar» aparece y reanuda;
«Cómo jugar» abre y cierra; el mute se escucha (o no) y persiste tras recargar; los 3 botones se
tocan cómodamente con el dedo en un móvil real o emulación táctil.

---

### Etapa 3 — Narrativa · `S` · ~3–4 h

**Objetivo:** viñeta del Nivel 1 presentada con ritmo de lectura infantil.

Tareas:
1. `NarrativeScene` genérica: renderiza `lore[]` del `LevelConfig` activo.
2. Paneles: fondo procedural por viñeta (laboratorio con púrpura / callejón), texto ≤ 40 palabras,
   avance por tap, indicador de progreso (1/4…4/4).
3. Botón «Saltar» (va directo a `ACTION`).
4. Transición fade + wipe de niebla hacia `ACTION`.

**Entregable:** narrativa jugable del Nivel 1.
**CA:** los 4 paneles de la SPEC §4.1 se muestran en orden con sus fondos; el tap avanza y
«Saltar» salta; ningún texto se corta ni desborda en 320 px de ancho.

---

### Etapa 4 — Minijuego de acción (Nivel 1) · `L` · ~10–14 h · **etapa crítica**

**Objetivo:** el corazón arcade del juego, completo y performante.

Tareas:
1. Escena de callejón: 3 capas parallax (edificios, niebla media, niebla frontal) + farolas con
   flicker; medición de FPS en móvil desde el primer día de la etapa.
2. La niña: sprite procedural (silueta + farol iluminado), movimiento errático según
   `speedRange`/`dirChangeMs` del config, rebote en bordes, animación simple de caminar.
3. Input: `pointerdown` sobre la niña (hitbox +20 %) → hit: flash + micro-shake + «!» + «+10»
   flotante + sonido; pointerdown al aire → puff de niebla + sonido suave, sin castigo.
4. `ui/Hud.ts` + `ui/TimerBar.ts`: «Sustos causados: X/3», timer 45 s (barra + segundos,
   rojo + tick en los últimos 5 s), puntaje vivo.
5. Meta 3/3: la niña huye de la pantalla → transición a `QUIZ`.
6. Timeout → overlay `GAME_OVER` animoso → «Reintentar» reinicia solo el minijuego
   (timer y contador a cero).
7. Bonus de tiempo: al lograr 3/3, sumar 2 pts/s restante (SCORE §5).
8. Botón pausa → vuelve a Menu marcando `inProgress`.

**Entregable:** minijuego completo con sus dos salidas (meta y timeout).
**CA:** en 10 partidas de prueba se logra la meta con margen y el timeout se provoca
deliberadamente; los contadores y el puntaje cuadran con la tabla de la SPEC §5 (p. ej.
3 taps + 20 s restantes + quiz pendiente = 70 pts acumulados); FPS ≥ 55 sostenidos en un móvil de
gama media; 60 taps rápidos seguidos no pierden ningún hit (multi-touch incluido).

---

### Etapa 5 — Quiz literario · `M` · ~5–7 h

**Objetivo:** evaluación pedagógica con las reglas de fallo acordadas.

Tareas:
1. `QuizScene` genérica: modal pergamino con pregunta y 4 tarjetas-opción (A–D) desde `QuizConfig`.
2. Opción incorrecta → feedback pedagógico de esa opción (2–3 líneas, SPEC §4.3) → botón
   «Volver a empezar el nivel» → **reinicio del nivel completo** (descarte de puntos de la tanda,
   vuelta a `NARRATIVE` con skip disponible).
3. Opción correcta → +100 pts → arpegio → panel con el fragmento de historia (carta antigua,
   SPEC §4.4) → botón «Continuar» → `VICTORY`.
4. Reinicio de nivel: `ScoreSystem` descarta la tanda; `SaveSystem` mantiene `inProgress`.
5. Estados visuales de tarjetas: normal / pressed / deshabilitada tras responder.

**Entregable:** quiz funcional con ambas ramas.
**CA:** respondiendo B se llega a `VICTORY` con +100 y fragmento visible; respondiendo A, C o D
aparece el feedback específico de esa opción y el flujo vuelve a `NARRATIVE` con el puntaje de la
tanda en 0; tras reiniciar y acertar, el puntaje final refleja solo la segunda tanda.

---

### Etapa 6 — Victoria · `S` · ~3–4 h

**Objetivo:** cierre emocional y resumen pedagógico.

Tareas:
1. `VictoryScene`: diploma procedural (marco pergamino, sello de cera púrpura) con felicitación
   por haber leído la obra.
2. Desglose de puntaje: taps + quiz + bonus de tiempo, total y récord (`lastScore`).
3. Input opcional de nombre para el diploma (campo de texto simple).
4. Botones «Jugar de nuevo» (resetea tanda, mantiene récord) y «Volver al inicio».
5. Actualización de save: `levelsCompleted = 1`, `inProgress = false`.

**Entregable:** pantalla final completa.
**CA:** tras ganar, el diploma muestra el desglose correcto; «Jugar de nuevo» reinicia el nivel
desde la narrativa conservando el récord; recargar tras ganar no muestra «Continuar» en Menu.

---

### Etapa 7 — Pulido y QA · `M` · ~4–6 h

**Objetivo:** calidad de producto y verificación integral contra la SPEC.

Tareas:
1. Pasada de pulido de animaciones (timing de fades, shakes, deriva de niebla) y audio (volúmenes
   relativos).
2. QA responsive: 320 px de ancho → desktop 1920×1080; orientación vertical y horizontal
   (letterbox decorado); zoom del navegador al 150 %.
3. QA táctil en dispositivo real: hitboxes, botones, sin áreas muertas; multi-touch.
4. Prueba de persistencia: matar pestaña en cada estado y verificar reanudación.
5. Checklist de accesibilidad de la SPEC §9 (contraste, tamaños de texto, textos cortos).
6. Revisión de textos por un adulto/educador (riesgo de contenido, SPEC §13).
7. Build de producción + deploy; smoke test de la versión publicada.

**Entregable:** v1 publicada.
**CA:** la Definition of Done (§3) se cumple al 100 % en la build publicada.

---

## 3. Definition of Done (v1)

- [ ] Funciona 100 % client-side; sin llamadas de red tras la carga (salvo fuentes en el primer load).
- [ ] Responsive verificado de 320 px a 1920 px, táctil y mouse.
- [ ] Flujo completo jugable: Menu → Intro → Narrativa → Acción → Quiz → Victoria.
- [ ] Reglas de fallo correctas: timeout reintenta minijuego; quiz incorrecto reinicia nivel completo.
- [ ] Puntaje conforme a SPEC §5, con desglose en la pantalla final.
- [ ] Progreso y mute persisten tras recargar en cualquier estado; save corrupto no rompe el juego.
- [ ] FPS ≥ 55 en móvil de gama media durante el minijuego.
- [ ] Sin assets externos de pago ni licencias pendientes (todo procedural + Google Fonts).
- [ ] Textos revisados para público 10+ (violencia sugerida, nunca mostrada).
- [ ] `npm run build` sin errores ni warnings de TS; deploy estático funcionando.

---

## 4. Estimación total

| Etapa | Tamaño | Horas-ideales |
|---|---|---|
| 0 — Setup | S | 2–3 |
| 1 — Fundaciones | M | 4–6 |
| 2 — Menu | S | 3–4 |
| 3 — Narrativa | S | 3–4 |
| 4 — Minijuego | L | 10–14 |
| 5 — Quiz | M | 5–7 |
| 6 — Victoria | S | 3–4 |
| 7 — Pulido/QA | M | 4–6 |
| **Total** | | **~34–48 h** |

La Etapa 4 concentra el riesgo técnico (render de niebla + input táctil); si hay recortes de
tiempo, candidates a simplificar son la animación de caminar de la niña y el letterbox decorado,
nunca las reglas de juego ni el feedback.

---

## 5. Backlog post-v1 (fuera de alcance)

- **Nivel 2 — El Asaltante de la Niebla** (`chase-escape`, 5 taps antes del escape) — diseño en
  SPEC §12 / `start.md`.
- **Nivel 3 — El Secreto del Gabinete** (`collect-falling`, 5 frascos) — ídem.
- Banco de preguntas por nivel (pool aleatorio por corrida).
- Música de ambiente sintetizada en loop.
- i18n (es/en).
- PWA + caché offline instalable.
- Elección final del título del juego (SPEC §1.1) y branding.
