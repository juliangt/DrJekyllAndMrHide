# QA-CHECKLIST — Verificación manual en dispositivo real

> Etapa 7 — Pulido y QA (PLAN §2.7). Este checklist cubre **lo que NO es
> automatizable** sin hardware: FPS reales, multi-touch, teclado virtual,
> políticas de autoplay de iOS/Safari y percepción visual en pantalla física.
> Todo lo automatizable ya está cubierto por la suite (`npm test`), incluida
> la Definition of Done ejecutable (`src/__tests__/definitionOfDone.test.ts`).
>
> **Cómo usarlo:** servir la build (`npm run build && npm run preview`) o el
> dev server, abrir desde el dispositivo real en la misma red y recorrer los
> ítems en orden. Apuntar el resultado y la fecha al pie de cada ítem.

**Dispositivo usado:** ______________________  **Navegador/versión:** ______________
**Fecha:** ______________  **Probado por:** ______________

---

## 1. FPS ≥ 55 en el minijuego (CA del PLAN Etapa 4)

**Cómo probarlo:** abrir la URL con `?debug` (p. ej.
`https://…/index.html?debug`). Jugar Menu → Narrativa → Acción y sostener el
minijuego ~30 s tocando a la niña y moviéndose por la pantalla. Leer el
contador «N FPS» (esquina inferior izquierda, 2 lecturas/s).

- [ ] FPS ≥ 55 sostenidos durante la tanda completa (45 s).
- [ ] Sin caídas bruscas al tocar (los puffs de niebla no hunden el frame).
- [ ] En horizontal el contador también se lee (no queda recortado).

Resultado: __________ FPS (mín. observado) — Notas: ______________________

## 2. 60 taps rápidos con multi-touch (sin hits perdidos)

**Cómo probarlo:** en el minijuego con `?debug` visible (o sin él), tocar
rápidamente ~60 veces en 10 s alternando uno y dos dedos: la mitad sobre la
niña y la mitad al aire. Verificar el contador «Sustos causados» y el puntaje.

- [ ] Cada tap sobre la niña suma +10 (ningún hit se pierde).
- [ ] Los taps con DOS dedos a la vez cuentan ambos (multi-touch real).
- [ ] Ningún tap al aire produce lag, crash o doble feedback.
- [ ] Tras «Reintentar» (timeout), los taps vuelven a registrar limpio.

Resultado: __________ — Notas: _________________________________________

## 3. Hitbox y botones con dedos (sin áreas muertas)

**Cómo probarlo:** recorrer TODOS los botones del juego con el dedo (no con
el stylus): «Comenzar el viaje», «Cómo jugar» (+ «Cerrar»), «Continuar»
(si aparece), «Saltar», «Pausa», «Reintentar», opciones A–D del quiz,
«Volver a empezar el nivel», «Continuar» (carta), «Jugar de nuevo»,
«Volver al inicio» y la línea de nombre del diploma.

- [ ] Todo botón responde al primer tap (sin necesidad de apuntar al centro).
- [ ] La niña responde incluso tocando el BORDE de su hitbox (+20 %).
- [ ] Tocar fuera de un botón (p. ej. sobre la viñeta) hace lo esperado
      (avanza panel en narrativa, puff de niebla en acción) y nunca dispara
      el botón vecino.
- [ ] El icono de mute (esquina superior derecha del menú) responde al tap.

Resultado: __________ — Notas: _________________________________________

## 4. Flujo completo en móvil real

**Cómo probarlo:** con sonido audible, recorrer Menu → Narrativa (4 viñetas)
→ Acción (ganar) → Quiz (acertar B) → Victoria → «Jugar de nuevo» → victoria
de nuevo → «Volver al inicio». Repetir una tanda provocando el timeout.

- [ ] Ninguna pantalla se corta ni desborda en la pantalla física.
- [ ] El tap avanza las 4 viñetas y «Saltar» salta a la acción.
- [ ] Al ganar 3/3, la niña huye y el bonus «+N» aparece antes del quiz.
- [ ] Responder B muestra la carta antigua y llega a la victoria con total.
- [ ] Responder A/C/D muestra SU feedback y reinicia el nivel completo.
- [ ] El timeout muestra «La niebla lo ocultó todo…» y «Reintentar» reinicia
      SOLO el minijuego (contador y timer a cero).

Resultado: __________ — Notas: _________________________________________

## 5. Orientación vertical y horizontal (letterbox decorado)

**Cómo probarlo:** girar el dispositivo en cada pantalla del flujo
(menú, narrativa, acción, quiz, victoria).

- [ ] En horizontal el canvas queda vertical y centrado, SIN recortes.
- [ ] Las bandas del letterbox muestran la niebla oscura del fondo de página
      (NO barras negras duras) — visible sobre todo en horizontal/desktop.
- [ ] Al girar en pleno minijuego el juego continúa sin reiniciarse.
- [ ] El HUD y el botón «Pausa» siguen siendo alcanzables en horizontal.

Resultado: __________ — Notas: _________________________________________

## 6. Zoom del navegador al 150 %

**Cómo probarlo:** en desktop (o el móvil si permite zoom de página — el
viewport móvil lo bloquea a propósito), poner zoom 150 % y recorrer el flujo.
Viewport efectivo ≈ 1280×853 en una pantalla 1920×1080.

- [ ] El canvas sigue cabiendo completo (nada recortado por los bordes).
- [ ] El input de nombre del diploma queda EXACTAMENTE sobre la línea del
      nombre (el mapeo canvas→CSS usa la misma escala FIT).
- [ ] Los textos siguen legibles a esa escala.

Resultado: __________ — Notas: _________________________________________

## 7. Input de nombre + teclado virtual

**Cómo probarlo:** llegar a la victoria y tocar la línea del nombre
(«Valiente lector/a» subrayada).

- [ ] El teclado virtual abre al PRIMER tap (dentro del gesto del usuario).
- [ ] Escribir con acentos (p. ej. «María») funciona y llega al diploma.
- [ ] El maxlength corta a 20 caracteres sin error visible.
- [ ] Enter (o «listo» del teclado) cierra el teclado y actualiza el diploma.
- [ ] Tocar fuera / cambiar de escena OCULTA el input (no queda flotando).
- [ ] El nombre se conserva si se juega de nuevo dentro de la misma sesión.

Resultado: __________ — Notas: _________________________________________

## 8. Audio en iOS/Safari (políticas de autoplay)

**Cómo probarlo:** iOS/Safari (y de paso Android/Chrome): cargar la página
SIN tocar nada y verificar silencio; luego primer tap y recorrer el juego.

- [ ] Sin gesto previo NO hay ningún error visible ni intento de audio fallido.
- [ ] El primer tap (menú) desbloquea el audio: el viento/blip suena desde
      la siguiente interacción.
- [ ] Thump del hit, puff del fallo, arpegio del quiz, tick de los últimos
      5 s y tono del timeout suenan y con volumen RELATIVO razonable
      (tick claramente más discreto que el thump; arpegio alegre sin estridir).
- [ ] El toggle de mute silencia TODO al instante y persiste tras recargar.
- [ ] Tras silenciar y reactivar, el blip de confirmación suena.

Resultado: __________ — Notas: _________________________________________

## 9. Persistencia matando la pestaña en cada estado

**Cómo probarlo:** en cada estado de la lista, cerrar la pestaña (o matar el
navegador desde el multitasking) y reabrir la URL.

- [ ] Menú sin partida: «Continuar» NO aparece.
- [ ] Tras «Comenzar» (narrativa): recarga → «Continuar» SÍ aparece.
- [ ] En pleno minijuego: recarga → «Continuar» aparece y reanuda en narrativa.
- [ ] En el quiz: recarga → ídem (sigue la partida en curso).
- [ ] Tras ganar: recarga → «Continuar» desaparece y el récord aparece en
      la siguiente victoria.
- [ ] Toggle de mute → recarga en cualquier estado → el mute persiste.
- [ ] (Extra, si se puede) Safari privado: el juego funciona y no rompe
      aunque el save no persista entre sesiones.

Resultado: __________ — Notas: _________________________________________

## 10. Contraste en pantalla real

**Cómo probarlo:** con brillo ALTO y luego BAJO (y luz de sol si es posible),
mirar: textos del HUD sobre el callejón, cuerpo del panel narrativo, opciones
del quiz, feedback de error/acierto (rojo/verde desaturados), diploma
(desglose, récord, pista de firma) y el GAME_OVER.

- [ ] Todo texto se lee sin forzar la vista incluso con brillo bajo.
- [ ] El rojo de la barra del timer (últimos 5 s) se distingue sin agresividad.
- [ ] El récord y la pista de firma del diploma se leen sobre el pergamino.
- [ ] El letterbox de niebla se percibe como marco, no como defecto.

Resultado: __________ — Notas: _________________________________________

## 11. Smoke test de la versión publicada (cuando Pages esté habilitado)

**Cómo probarlo:** ejecutar el workflow *Deploy to GitHub Pages* desde la
pestaña Actions (requiere Pages habilitado) y abrir la URL pública.

- [ ] La carga desde la URL de Pages funciona (assets relativos, `base: './'`).
- [ ] Recorrer el flujo completo una vez en la build PUBLICADA.
- [ ] El save y el mute persisten en la URL publicada (mismo origen).
- [ ] Fuentes de Google cargan (o el fallback serif se ve digno si se
      bloquean).

Resultado: __________ — Notas: _________________________________________

---

### Firmas

QA: ______________________  Aprobado para publicación: ______________________
